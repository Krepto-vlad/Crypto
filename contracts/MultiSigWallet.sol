// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title MultiSigWallet
 * @notice A multi-signature wallet that requires M-of-N owner approvals before
 *         executing any Ether transfer or arbitrary contract call.
 *
 * Design decisions
 * ----------------
 * - Owners are fixed at deployment (no add/remove to keep the surface small).
 * - Any owner can *submit* a transaction proposal.
 * - Any owner (including the submitter) can *confirm* a proposal.
 * - Once `numConfirmationsRequired` confirmations are collected any owner may
 *   *execute* it.
 * - Any owner can *revoke* their own confirmation before execution.
 * - The contract can receive plain Ether transfers via `receive()`.
 *
 * Security considerations
 * -----------------------
 * - Checks-Effects-Interactions pattern is used in `executeTransaction`.
 * - Re-entrancy is mitigated by marking the transaction as executed *before*
 *   making the external call.
 * - All state-changing functions are guarded with `onlyOwner`.
 * - Duplicate owners and the zero-address are rejected in the constructor.
 */
contract MultiSigWallet {
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted whenever the wallet receives Ether.
    event Deposit(address indexed sender, uint256 amount, uint256 balance);

    /// @notice Emitted when an owner submits a new transaction.
    event SubmitTransaction(
        address indexed owner,
        uint256 indexed txIndex,
        address indexed to,
        uint256 value,
        bytes data
    );

    /// @notice Emitted when an owner confirms a transaction.
    event ConfirmTransaction(address indexed owner, uint256 indexed txIndex);

    /// @notice Emitted when an owner revokes their confirmation.
    event RevokeConfirmation(address indexed owner, uint256 indexed txIndex);

    /// @notice Emitted when a transaction is successfully executed.
    event ExecuteTransaction(address indexed owner, uint256 indexed txIndex);

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice List of wallet owners.
    address[] public owners;

    /// @notice Quick lookup: is a given address an owner?
    mapping(address => bool) public isOwner;

    /// @notice Minimum number of confirmations required to execute a transaction.
    uint256 public numConfirmationsRequired;

    struct Transaction {
        address to;           // recipient address
        uint256 value;        // Ether value (wei)
        bytes data;           // call data (empty for plain ETH transfers)
        bool executed;        // has the transaction been executed?
        uint256 numConfirmations; // running count of confirmations
    }

    /// @notice All submitted transactions, indexed by txIndex.
    Transaction[] public transactions;

    /// @notice isConfirmed[txIndex][owner] — did this owner confirm this tx?
    mapping(uint256 => mapping(address => bool)) public isConfirmed;

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyOwner() {
        require(isOwner[msg.sender], "MultiSigWallet: not owner");
        _;
    }

    modifier txExists(uint256 _txIndex) {
        require(_txIndex < transactions.length, "MultiSigWallet: tx does not exist");
        _;
    }

    modifier notExecuted(uint256 _txIndex) {
        require(!transactions[_txIndex].executed, "MultiSigWallet: tx already executed");
        _;
    }

    modifier notConfirmed(uint256 _txIndex) {
        require(!isConfirmed[_txIndex][msg.sender], "MultiSigWallet: tx already confirmed");
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param _owners                 Addresses of the initial owners (must be unique, non-zero).
     * @param _numConfirmationsRequired Minimum approvals needed to execute a tx.
     */
    constructor(address[] memory _owners, uint256 _numConfirmationsRequired) {
        require(_owners.length > 0, "MultiSigWallet: owners required");
        require(
            _numConfirmationsRequired > 0 &&
                _numConfirmationsRequired <= _owners.length,
            "MultiSigWallet: invalid number of required confirmations"
        );

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];

            require(owner != address(0), "MultiSigWallet: invalid owner");
            require(!isOwner[owner], "MultiSigWallet: owner not unique");

            isOwner[owner] = true;
            owners.push(owner);
        }

        numConfirmationsRequired = _numConfirmationsRequired;
    }

    // -------------------------------------------------------------------------
    // Receive Ether
    // -------------------------------------------------------------------------

    /// @notice Accept plain Ether transfers and emit a Deposit event.
    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    // -------------------------------------------------------------------------
    // Core functions
    // -------------------------------------------------------------------------

    /**
     * @notice Submit a new transaction proposal.
     * @param _to    Recipient of the call / Ether transfer.
     * @param _value Amount of Ether to send (in wei).
     * @param _data  Encoded call data; pass `""` for plain ETH transfers.
     * @return txIndex Index of the newly created transaction.
     */
    function submitTransaction(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external onlyOwner returns (uint256 txIndex) {
        require(_to != address(0), "MultiSigWallet: invalid recipient");

        txIndex = transactions.length;

        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                numConfirmations: 0
            })
        );

        emit SubmitTransaction(msg.sender, txIndex, _to, _value, _data);
    }

    /**
     * @notice Confirm a pending transaction.
     * @param _txIndex Index of the transaction to confirm.
     */
    function confirmTransaction(uint256 _txIndex)
        external
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
        notConfirmed(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];

        // Effects
        isConfirmed[_txIndex][msg.sender] = true;
        transaction.numConfirmations += 1;

        emit ConfirmTransaction(msg.sender, _txIndex);
    }

    /**
     * @notice Execute a transaction that has reached the required confirmations.
     * @param _txIndex Index of the transaction to execute.
     */
    function executeTransaction(uint256 _txIndex)
        external
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];

        require(
            transaction.numConfirmations >= numConfirmationsRequired,
            "MultiSigWallet: not enough confirmations"
        );

        // Effects — mark as executed BEFORE the external call (CEI pattern)
        transaction.executed = true;

        // Interactions
        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );
        require(success, "MultiSigWallet: tx execution failed");

        emit ExecuteTransaction(msg.sender, _txIndex);
    }

    /**
     * @notice Revoke a previously given confirmation.
     *         Can only be called by the confirming owner and only before execution.
     * @param _txIndex Index of the transaction.
     */
    function revokeConfirmation(uint256 _txIndex)
        external
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
    {
        require(
            isConfirmed[_txIndex][msg.sender],
            "MultiSigWallet: tx not confirmed by sender"
        );

        Transaction storage transaction = transactions[_txIndex];

        // Effects
        isConfirmed[_txIndex][msg.sender] = false;
        transaction.numConfirmations -= 1;

        emit RevokeConfirmation(msg.sender, _txIndex);
    }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    /// @notice Returns the full list of owners.
    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    /// @notice Returns the total number of submitted transactions.
    function getTransactionCount() external view returns (uint256) {
        return transactions.length;
    }

    /**
     * @notice Returns the details of a specific transaction.
     * @param _txIndex Index of the transaction.
     */
    function getTransaction(uint256 _txIndex)
        external
        view
        txExists(_txIndex)
        returns (
            address to,
            uint256 value,
            bytes memory data,
            bool executed,
            uint256 numConfirmations
        )
    {
        Transaction storage transaction = transactions[_txIndex];
        return (
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.executed,
            transaction.numConfirmations
        );
    }
}
