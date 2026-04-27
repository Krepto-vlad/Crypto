import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import {
  parseEther,
  BaseError,
  ContractFunctionRevertedError,
  getAddress,
  type WalletClient,
  type PublicClient,
} from "viem";

function assertRevert(error: unknown, expectedMessage: string): void {
  assert.ok(error instanceof BaseError, `Expected a BaseError, got: ${error}`);

  const revert = error.walk(
    (e) => e instanceof ContractFunctionRevertedError,
  ) as ContractFunctionRevertedError | null;

  if (revert?.data?.errorName) {
    assert.ok(
      revert.data.errorName === expectedMessage ||
        revert.data.args?.toString().includes(expectedMessage),
      `Expected revert with "${expectedMessage}", got: ${revert.data.errorName}`,
    );
  } else {
    assert.ok(
      error.message.includes(expectedMessage),
      `Expected error message to include "${expectedMessage}", got:\n${error.message}`,
    );
  }
}

async function deployWallet(confirmationsRequired = 2) {
  const { viem } = await network.connect();
  const walletClients = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  const [owner1, owner2, owner3, nonOwner] = walletClients;

  const ownerAddresses = [
    owner1.account.address,
    owner2.account.address,
    owner3.account.address,
  ];

  const wallet = await viem.deployContract("MultiSigWallet", [
    ownerAddresses,
    BigInt(confirmationsRequired),
  ]);

  return {
    wallet,
    owner1,
    owner2,
    owner3,
    nonOwner,
    publicClient,
    ownerAddresses,
  };
}

describe("MultiSigWallet", function () {
  describe("1. Deployment & initialisation", function () {
    it("stores the correct owners", async function () {
      const { wallet, ownerAddresses } = await deployWallet();
      const storedOwners = await wallet.read.getOwners();
      assert.deepEqual(
        storedOwners.map((a: string) => a.toLowerCase()),
        ownerAddresses.map((a) => a.toLowerCase()),
      );
    });

    it("sets numConfirmationsRequired correctly", async function () {
      const { wallet } = await deployWallet(2);
      assert.equal(await wallet.read.numConfirmationsRequired(), BigInt(2));
    });

    it("marks each owner in the isOwner mapping", async function () {
      const { wallet, owner1, owner2, owner3 } = await deployWallet();
      assert.equal(await wallet.read.isOwner([owner1.account.address]), true);
      assert.equal(await wallet.read.isOwner([owner2.account.address]), true);
      assert.equal(await wallet.read.isOwner([owner3.account.address]), true);
    });

    it("marks a non-owner as false in the isOwner mapping", async function () {
      const { wallet, nonOwner } = await deployWallet();
      assert.equal(
        await wallet.read.isOwner([nonOwner.account.address]),
        false,
      );
    });

    it("reverts when no owners are provided", async function () {
      const { viem } = await network.connect();
      await assert.rejects(
        () => viem.deployContract("MultiSigWallet", [[], BigInt(1)]),
        (err: unknown) => {
          assertRevert(err, "owners required");
          return true;
        },
      );
    });

    it("reverts when confirmations required is 0", async function () {
      const { viem } = await network.connect();
      const { viem: v2 } = await network.connect();
      const clients = await v2.getWalletClients();
      await assert.rejects(
        () =>
          viem.deployContract("MultiSigWallet", [
            [clients[0].account.address],
            BigInt(0),
          ]),
        (err: unknown) => {
          assertRevert(err, "invalid number of required confirmations");
          return true;
        },
      );
    });

    it("reverts when confirmations required exceeds owner count", async function () {
      const { viem } = await network.connect();
      const clients = await viem.getWalletClients();
      await assert.rejects(
        () =>
          viem.deployContract("MultiSigWallet", [
            [clients[0].account.address, clients[1].account.address],
            BigInt(5),
          ]),
        (err: unknown) => {
          assertRevert(err, "invalid number of required confirmations");
          return true;
        },
      );
    });

    it("reverts on duplicate owner addresses", async function () {
      const { viem } = await network.connect();
      const clients = await viem.getWalletClients();
      const addr = clients[0].account.address;
      await assert.rejects(
        () => viem.deployContract("MultiSigWallet", [[addr, addr], BigInt(1)]),
        (err: unknown) => {
          assertRevert(err, "owner not unique");
          return true;
        },
      );
    });

    it("reverts when a zero address is used as owner", async function () {
      const { viem } = await network.connect();
      const clients = await viem.getWalletClients();
      await assert.rejects(
        () =>
          viem.deployContract("MultiSigWallet", [
            [
              clients[0].account.address,
              "0x0000000000000000000000000000000000000000",
            ],
            BigInt(1),
          ]),
        (err: unknown) => {
          assertRevert(err, "invalid owner");
          return true;
        },
      );
    });
  });

  describe("2. Receiving Ether", function () {
    it("accepts Ether and emits Deposit event", async function () {
      const { wallet, owner1, publicClient } = await deployWallet();
      const amount = parseEther("1");

      const txHash = await owner1.sendTransaction({
        to: wallet.address,
        value: amount,
      });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      const balance = await publicClient.getBalance({
        address: wallet.address,
      });
      assert.equal(balance, amount);

      const logs = await publicClient.getContractEvents({
        address: wallet.address,
        abi: wallet.abi,
        eventName: "Deposit",
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      });
      assert.equal(logs.length, 1);
      assert.equal(logs[0].args.amount, amount);
    });
  });

  describe("3. Submitting transactions", function () {
    it("allows an owner to submit a transaction", async function () {
      const { wallet, owner1, owner2 } = await deployWallet();
      const value = parseEther("0.5");

      await wallet.write.submitTransaction(
        [owner2.account.address, value, "0x"],
        { account: owner1.account },
      );

      const count = await wallet.read.getTransactionCount();
      assert.equal(count, BigInt(1));
    });

    it("emits SubmitTransaction event with correct args", async function () {
      const { wallet, owner1, owner2, publicClient } = await deployWallet();
      const value = parseEther("0.5");

      const hash = await wallet.write.submitTransaction(
        [owner2.account.address, value, "0x"],
        { account: owner1.account },
      );
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      const logs = await publicClient.getContractEvents({
        address: wallet.address,
        abi: wallet.abi,
        eventName: "SubmitTransaction",
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      });
      assert.equal(logs.length, 1);
      assert.equal(logs[0].args.txIndex, BigInt(0));
      assert.equal(
        logs[0].args.to?.toLowerCase(),
        owner2.account.address.toLowerCase(),
      );
      assert.equal(logs[0].args.value, value);
    });

    it("stores transaction with executed=false and 0 confirmations", async function () {
      const { wallet, owner1, owner2 } = await deployWallet();

      await wallet.write.submitTransaction(
        [owner2.account.address, parseEther("0.1"), "0x"],
        { account: owner1.account },
      );

      const [to, val, data, executed, numConf] =
        await wallet.read.getTransaction([BigInt(0)]);
      assert.equal(to.toLowerCase(), owner2.account.address.toLowerCase());
      assert.equal(val, parseEther("0.1"));
      assert.equal(executed, false);
      assert.equal(numConf, BigInt(0));
    });

    it("reverts when a non-owner tries to submit", async function () {
      const { wallet, owner1, nonOwner } = await deployWallet();

      await assert.rejects(
        () =>
          wallet.write.submitTransaction(
            [owner1.account.address, parseEther("0.1"), "0x"],
            { account: nonOwner.account },
          ),
        (err: unknown) => {
          assertRevert(err, "not owner");
          return true;
        },
      );
    });

    it("reverts when recipient is the zero address", async function () {
      const { wallet, owner1 } = await deployWallet();

      await assert.rejects(
        () =>
          wallet.write.submitTransaction(
            ["0x0000000000000000000000000000000000000000", BigInt(0), "0x"],
            { account: owner1.account },
          ),
        (err: unknown) => {
          assertRevert(err, "invalid recipient");
          return true;
        },
      );
    });
  });

  describe("4. Confirming transactions", function () {
    async function deployWithTx() {
      const ctx = await deployWallet();
      const { wallet, owner1, owner2 } = ctx;

      await wallet.write.submitTransaction(
        [owner2.account.address, parseEther("0"), "0x"],
        { account: owner1.account },
      );
      return ctx;
    }

    it("allows an owner to confirm a transaction", async function () {
      const { wallet, owner1 } = await deployWithTx();

      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner1.account,
      });

      const confirmed = await wallet.read.isConfirmed([
        BigInt(0),
        owner1.account.address,
      ]);
      assert.equal(confirmed, true);

      const [, , , , numConf] = await wallet.read.getTransaction([BigInt(0)]);
      assert.equal(numConf, BigInt(1));
    });

    it("emits ConfirmTransaction event", async function () {
      const { wallet, owner1, publicClient } = await deployWithTx();

      const hash = await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner1.account,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      const logs = await publicClient.getContractEvents({
        address: wallet.address,
        abi: wallet.abi,
        eventName: "ConfirmTransaction",
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      });
      assert.equal(logs.length, 1);
      assert.equal(logs[0].args.txIndex, BigInt(0));
    });

    it("multiple owners can each confirm", async function () {
      const { wallet, owner1, owner2, owner3 } = await deployWithTx();

      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner1.account,
      });
      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner2.account,
      });

      const [, , , , numConf] = await wallet.read.getTransaction([BigInt(0)]);
      assert.equal(numConf, BigInt(2));
    });

    it("reverts on duplicate confirmation by the same owner", async function () {
      const { wallet, owner1 } = await deployWithTx();

      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner1.account,
      });

      await assert.rejects(
        () =>
          wallet.write.confirmTransaction([BigInt(0)], {
            account: owner1.account,
          }),
        (err: unknown) => {
          assertRevert(err, "tx already confirmed");
          return true;
        },
      );
    });

    it("reverts when confirming a non-existent transaction", async function () {
      const { wallet, owner1 } = await deployWithTx();

      await assert.rejects(
        () =>
          wallet.write.confirmTransaction([BigInt(99)], {
            account: owner1.account,
          }),
        (err: unknown) => {
          assertRevert(err, "tx does not exist");
          return true;
        },
      );
    });

    it("reverts when a non-owner tries to confirm", async function () {
      const { wallet, nonOwner } = await deployWithTx();

      await assert.rejects(
        () =>
          wallet.write.confirmTransaction([BigInt(0)], {
            account: nonOwner.account,
          }),
        (err: unknown) => {
          assertRevert(err, "not owner");
          return true;
        },
      );
    });
  });

  describe("5. Revoking confirmations", function () {
    async function deployConfirmed() {
      const ctx = await deployWallet();
      const { wallet, owner1, owner2 } = ctx;

      await wallet.write.submitTransaction(
        [owner2.account.address, BigInt(0), "0x"],
        { account: owner1.account },
      );
      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner1.account,
      });
      return ctx;
    }

    it("allows an owner to revoke their own confirmation", async function () {
      const { wallet, owner1 } = await deployConfirmed();

      await wallet.write.revokeConfirmation([BigInt(0)], {
        account: owner1.account,
      });

      const confirmed = await wallet.read.isConfirmed([
        BigInt(0),
        owner1.account.address,
      ]);
      assert.equal(confirmed, false);

      const [, , , , numConf] = await wallet.read.getTransaction([BigInt(0)]);
      assert.equal(numConf, BigInt(0));
    });

    it("emits RevokeConfirmation event", async function () {
      const { wallet, owner1, publicClient } = await deployConfirmed();

      const hash = await wallet.write.revokeConfirmation([BigInt(0)], {
        account: owner1.account,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      const logs = await publicClient.getContractEvents({
        address: wallet.address,
        abi: wallet.abi,
        eventName: "RevokeConfirmation",
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      });
      assert.equal(logs.length, 1);
    });

    it("reverts when trying to revoke a confirmation that was never given", async function () {
      const { wallet, owner2 } = await deployConfirmed();

      await assert.rejects(
        () =>
          wallet.write.revokeConfirmation([BigInt(0)], {
            account: owner2.account,
          }),
        (err: unknown) => {
          assertRevert(err, "tx not confirmed by sender");
          return true;
        },
      );
    });

    it("reverts when a non-owner tries to revoke", async function () {
      const { wallet, nonOwner } = await deployConfirmed();

      await assert.rejects(
        () =>
          wallet.write.revokeConfirmation([BigInt(0)], {
            account: nonOwner.account,
          }),
        (err: unknown) => {
          assertRevert(err, "not owner");
          return true;
        },
      );
    });
  });

  describe("6. Executing transactions", function () {
    async function deployFundedWithTx() {
      const ctx = await deployWallet(2); // 2-of-3
      const { wallet, owner1, owner2, owner3 } = ctx;

      await owner1.sendTransaction({
        to: wallet.address,
        value: parseEther("2"),
      });

      await wallet.write.submitTransaction(
        [owner3.account.address, parseEther("1"), "0x"],
        { account: owner1.account },
      );

      return ctx;
    }

    it("executes when enough confirmations are collected", async function () {
      const { wallet, owner1, owner2, owner3, publicClient } =
        await deployFundedWithTx();

      const balanceBefore = await publicClient.getBalance({
        address: owner3.account.address,
      });

      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner1.account,
      });
      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner2.account,
      });
      await wallet.write.executeTransaction([BigInt(0)], {
        account: owner1.account,
      });

      const balanceAfter = await publicClient.getBalance({
        address: owner3.account.address,
      });

      assert.ok(
        balanceAfter - balanceBefore === parseEther("1"),
        "owner3 should have received 1 ETH",
      );
    });

    it("marks the transaction as executed", async function () {
      const { wallet, owner1, owner2 } = await deployFundedWithTx();

      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner1.account,
      });
      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner2.account,
      });
      await wallet.write.executeTransaction([BigInt(0)], {
        account: owner1.account,
      });

      const [, , , executed] = await wallet.read.getTransaction([BigInt(0)]);
      assert.equal(executed, true);
    });

    it("emits ExecuteTransaction event", async function () {
      const { wallet, owner1, owner2, publicClient } =
        await deployFundedWithTx();

      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner1.account,
      });
      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner2.account,
      });

      const hash = await wallet.write.executeTransaction([BigInt(0)], {
        account: owner1.account,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      const logs = await publicClient.getContractEvents({
        address: wallet.address,
        abi: wallet.abi,
        eventName: "ExecuteTransaction",
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      });
      assert.equal(logs.length, 1);
    });

    it("reverts when not enough confirmations", async function () {
      const { wallet, owner1 } = await deployFundedWithTx();

      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner1.account,
      });

      await assert.rejects(
        () =>
          wallet.write.executeTransaction([BigInt(0)], {
            account: owner1.account,
          }),
        (err: unknown) => {
          assertRevert(err, "not enough confirmations");
          return true;
        },
      );
    });

    it("reverts on double execution", async function () {
      const { wallet, owner1, owner2 } = await deployFundedWithTx();

      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner1.account,
      });
      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner2.account,
      });
      await wallet.write.executeTransaction([BigInt(0)], {
        account: owner1.account,
      });

      await assert.rejects(
        () =>
          wallet.write.executeTransaction([BigInt(0)], {
            account: owner1.account,
          }),
        (err: unknown) => {
          assertRevert(err, "tx already executed");
          return true;
        },
      );
    });

    it("reverts when a non-owner tries to execute", async function () {
      const { wallet, owner1, owner2, nonOwner } = await deployFundedWithTx();

      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner1.account,
      });
      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner2.account,
      });

      await assert.rejects(
        () =>
          wallet.write.executeTransaction([BigInt(0)], {
            account: nonOwner.account,
          }),
        (err: unknown) => {
          assertRevert(err, "not owner");
          return true;
        },
      );
    });

    it("reverts confirmation after execution", async function () {
      const { wallet, owner1, owner2, owner3 } = await deployFundedWithTx();

      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner1.account,
      });
      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner2.account,
      });
      await wallet.write.executeTransaction([BigInt(0)], {
        account: owner1.account,
      });

      await assert.rejects(
        () =>
          wallet.write.confirmTransaction([BigInt(0)], {
            account: owner3.account,
          }),
        (err: unknown) => {
          assertRevert(err, "tx already executed");
          return true;
        },
      );
    });
  });

  describe("7. Edge cases", function () {
    it("1-of-1 wallet: single owner can submit and immediately execute", async function () {
      const { viem } = await network.connect();
      const [sole] = await viem.getWalletClients();
      const publicClient = await viem.getPublicClient();

      const wallet = await viem.deployContract("MultiSigWallet", [
        [sole.account.address],
        BigInt(1),
      ]);

      await sole.sendTransaction({
        to: wallet.address,
        value: parseEther("1"),
      });

      await wallet.write.submitTransaction(
        [sole.account.address, parseEther("0.5"), "0x"],
        { account: sole.account },
      );

      await wallet.write.confirmTransaction([BigInt(0)], {
        account: sole.account,
      });
      await wallet.write.executeTransaction([BigInt(0)], {
        account: sole.account,
      });

      const [, , , executed] = await wallet.read.getTransaction([BigInt(0)]);
      assert.equal(executed, true);
    });

    it("revoke then re-confirm prevents early execution", async function () {
      const { wallet, owner1, owner2 } = await deployWallet(2);

      await owner1.sendTransaction({
        to: wallet.address,
        value: parseEther("1"),
      });

      await wallet.write.submitTransaction(
        [owner2.account.address, parseEther("0.5"), "0x"],
        { account: owner1.account },
      );

      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner1.account,
      });
      await wallet.write.revokeConfirmation([BigInt(0)], {
        account: owner1.account,
      });

      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner2.account,
      });

      await assert.rejects(
        () =>
          wallet.write.executeTransaction([BigInt(0)], {
            account: owner2.account,
          }),
        (err: unknown) => {
          assertRevert(err, "not enough confirmations");
          return true;
        },
      );

      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner1.account,
      });
      await wallet.write.executeTransaction([BigInt(0)], {
        account: owner1.account,
      });

      const [, , , executed] = await wallet.read.getTransaction([BigInt(0)]);
      assert.equal(executed, true);
    });

    it("multiple independent transactions have independent state", async function () {
      const { wallet, owner1, owner2, owner3 } = await deployWallet(2);
      await owner1.sendTransaction({
        to: wallet.address,
        value: parseEther("2"),
      });

      await wallet.write.submitTransaction(
        [owner2.account.address, parseEther("0.1"), "0x"],
        { account: owner1.account },
      );
      await wallet.write.submitTransaction(
        [owner3.account.address, parseEther("0.2"), "0x"],
        { account: owner1.account },
      );

      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner1.account,
      });
      await wallet.write.confirmTransaction([BigInt(0)], {
        account: owner2.account,
      });

      await wallet.write.executeTransaction([BigInt(0)], {
        account: owner1.account,
      });

      const [, , , executed1, numConf1] = await wallet.read.getTransaction([
        BigInt(1),
      ]);
      assert.equal(executed1, false);
      assert.equal(numConf1, BigInt(0));
    });

    it("getTransactionCount increases with each submission", async function () {
      const { wallet, owner1, owner2 } = await deployWallet();

      assert.equal(await wallet.read.getTransactionCount(), BigInt(0));

      await wallet.write.submitTransaction(
        [owner2.account.address, BigInt(0), "0x"],
        { account: owner1.account },
      );
      assert.equal(await wallet.read.getTransactionCount(), BigInt(1));

      await wallet.write.submitTransaction(
        [owner2.account.address, BigInt(0), "0x"],
        { account: owner1.account },
      );
      assert.equal(await wallet.read.getTransactionCount(), BigInt(2));
    });
  });
});
