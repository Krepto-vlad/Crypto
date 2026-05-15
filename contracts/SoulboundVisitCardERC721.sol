// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title SoulboundVisitCardERC721
 * @notice ERC-721 NFT representing a student visit card. Soulbound: cannot be
 *         transferred or approved after minting. Only the contract owner can mint.
 */
contract SoulboundVisitCardERC721 is ERC721, Ownable {
    using Strings for uint256;
    using Strings for address;

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    struct StudentCard {
        string studentName;
        string studentID;
        string course;
        string year;
    }

    // tokenId => student metadata
    mapping(uint256 => StudentCard) private _cards;

    // student wallet => tokenId (each student can hold at most one card)
    mapping(address => uint256) private _studentToken;
    mapping(address => bool) private _hasMinted;

    uint256 private _nextTokenId;

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error Soulbound();
    error AlreadyMinted(address student);
    error NoCardMinted(address student);

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event VisitCardMinted(
        uint256 indexed tokenId,
        address indexed student,
        string studentName,
        string studentID
    );

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor() ERC721("Student Visit Card", "SVC") Ownable(msg.sender) {
        _nextTokenId = 1;
    }

    // -------------------------------------------------------------------------
    // Minting (owner only)
    // -------------------------------------------------------------------------

    /**
     * @notice Mint exactly one soulbound visit card to a student's wallet.
     * @param to          Student wallet address.
     * @param studentName Full name of the student.
     * @param studentID   Unique student ID (e.g. "STU-2024-001").
     * @param course      Course name (e.g. "Blockchain & Crypto").
     * @param year        Academic year (e.g. "2024").
     */
    function mintVisitCard(
        address to,
        string calldata studentName,
        string calldata studentID,
        string calldata course,
        string calldata year
    ) external onlyOwner {
        if (_hasMinted[to]) revert AlreadyMinted(to);

        uint256 tokenId = _nextTokenId++;
        _hasMinted[to] = true;
        _studentToken[to] = tokenId;

        _cards[tokenId] = StudentCard({
            studentName: studentName,
            studentID: studentID,
            course: course,
            year: year
        });

        _safeMint(to, tokenId);

        emit VisitCardMinted(tokenId, to, studentName, studentID);
    }

    // -------------------------------------------------------------------------
    // Metadata — fully on-chain (base64 SVG + JSON)
    // -------------------------------------------------------------------------

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        StudentCard memory card = _cards[tokenId];

        string memory escapedName = _escapeJson(card.studentName);
        string memory escapedStudentID = _escapeJson(card.studentID);
        string memory escapedCourse = _escapeJson(card.course);
        string memory escapedYear = _escapeJson(card.year);

        string memory svg = _buildSVG(card, tokenId);
        string memory imageURI = string(
            abi.encodePacked(
                "data:image/svg+xml;base64,",
                Base64.encode(bytes(svg))
            )
        );

        string memory json = string(
            abi.encodePacked(
                '{"name":"Visit Card #', tokenId.toString(), ' - ', escapedName, '",',
                '"description":"Soulbound student visit card NFT. Non-transferable.",',
                '"image":"', imageURI, '",',
                '"attributes":[',
                    '{"trait_type":"Student Name","value":"', escapedName, '"},',
                    '{"trait_type":"Student ID","value":"', escapedStudentID, '"},',
                    '{"trait_type":"Course","value":"', escapedCourse, '"},',
                    '{"trait_type":"Year","value":"', escapedYear, '"},',
                    '{"trait_type":"Soulbound","value":"true"}',
                ']}'
            )
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(bytes(json))
            )
        );
    }

    function _buildSVG(StudentCard memory card, uint256 tokenId) internal pure returns (string memory) {
        string memory nameXml = _escapeXml(card.studentName);
        string memory studentIdXml = _escapeXml(card.studentID);
        string memory courseXml = _escapeXml(card.course);
        string memory yearXml = _escapeXml(card.year);

        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250">',
                '<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">',
                '<stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />',
                '<stop offset="100%" style="stop-color:#16213e;stop-opacity:1" /></linearGradient></defs>',
                '<rect width="400" height="250" rx="16" fill="url(#bg)"/>',
                '<rect x="4" y="4" width="392" height="242" rx="14" fill="none" stroke="#0f3460" stroke-width="2"/>',
                '<circle cx="48" cy="48" r="28" fill="#0f3460"/>',
                '<text x="48" y="55" text-anchor="middle" font-size="22" fill="#e94560" font-family="monospace" font-weight="bold">ID</text>',
                '<text x="90" y="36" font-size="11" fill="#8892b0" font-family="monospace">STUDENT VISIT CARD</text>',
                '<text x="90" y="55" font-size="17" fill="#ccd6f6" font-family="monospace" font-weight="bold">', nameXml, '</text>',
                '<line x1="24" y1="80" x2="376" y2="80" stroke="#0f3460" stroke-width="1"/>',
                '<text x="24" y="106" font-size="11" fill="#8892b0" font-family="monospace">STUDENT ID</text>',
                '<text x="24" y="124" font-size="14" fill="#e94560" font-family="monospace" font-weight="bold">', studentIdXml, '</text>',
                '<text x="220" y="106" font-size="11" fill="#8892b0" font-family="monospace">COURSE</text>',
                '<text x="220" y="124" font-size="13" fill="#ccd6f6" font-family="monospace">', courseXml, '</text>',
                '<text x="24" y="158" font-size="11" fill="#8892b0" font-family="monospace">YEAR</text>',
                '<text x="24" y="176" font-size="14" fill="#ccd6f6" font-family="monospace">', yearXml, '</text>',
                '<text x="220" y="158" font-size="11" fill="#8892b0" font-family="monospace">TOKEN ID</text>',
                '<text x="220" y="176" font-size="14" fill="#ccd6f6" font-family="monospace">#', tokenId.toString(), '</text>',
                '<text x="24" y="224" font-size="10" fill="#e94560" font-family="monospace">&#128274; SOULBOUND - NON-TRANSFERABLE</text>',
                '</svg>'
            )
        );
    }

    // -------------------------------------------------------------------------
    // Read helpers
    // -------------------------------------------------------------------------

    function getCard(uint256 tokenId) external view returns (StudentCard memory) {
        _requireOwned(tokenId);
        return _cards[tokenId];
    }

    function tokenOfStudent(address student) external view returns (uint256) {
        if (!_hasMinted[student]) revert NoCardMinted(student);
        return _studentToken[student];
    }

    function _escapeJson(string memory value) internal pure returns (string memory) {
        bytes memory src = bytes(value);
        bytes memory dst = new bytes(src.length * 2 + 8);
        uint256 j = 0;

        for (uint256 i = 0; i < src.length; i++) {
            bytes1 c = src[i];
            if (c == '"') {
                dst[j++] = '\\';
                dst[j++] = '"';
            } else if (c == '\\') {
                dst[j++] = '\\';
                dst[j++] = '\\';
            } else if (c == 0x0A) {
                dst[j++] = '\\';
                dst[j++] = 'n';
            } else if (c == 0x0D) {
                dst[j++] = '\\';
                dst[j++] = 'r';
            } else if (c == 0x09) {
                dst[j++] = '\\';
                dst[j++] = 't';
            } else {
                dst[j++] = c;
            }
        }

        bytes memory out = new bytes(j);
        for (uint256 i = 0; i < j; i++) {
            out[i] = dst[i];
        }
        return string(out);
    }

    function _escapeXml(string memory value) internal pure returns (string memory) {
        bytes memory src = bytes(value);
        bytes memory dst = new bytes(src.length * 6 + 8);
        uint256 j = 0;

        for (uint256 i = 0; i < src.length; i++) {
            bytes1 c = src[i];
            if (c == '&') {
                dst[j++] = '&'; dst[j++] = 'a'; dst[j++] = 'm'; dst[j++] = 'p'; dst[j++] = ';';
            } else if (c == '<') {
                dst[j++] = '&'; dst[j++] = 'l'; dst[j++] = 't'; dst[j++] = ';';
            } else if (c == '>') {
                dst[j++] = '&'; dst[j++] = 'g'; dst[j++] = 't'; dst[j++] = ';';
            } else if (c == '"') {
                dst[j++] = '&'; dst[j++] = 'q'; dst[j++] = 'u'; dst[j++] = 'o'; dst[j++] = 't'; dst[j++] = ';';
            } else if (c == '\'') {
                dst[j++] = '&'; dst[j++] = 'a'; dst[j++] = 'p'; dst[j++] = 'o'; dst[j++] = 's'; dst[j++] = ';';
            } else {
                dst[j++] = c;
            }
        }

        bytes memory out = new bytes(j);
        for (uint256 i = 0; i < j; i++) {
            out[i] = dst[i];
        }
        return string(out);
    }

    // -------------------------------------------------------------------------
    // Soulbound: block all transfers and approvals after mint
    // -------------------------------------------------------------------------

    /**
     * @dev Override _update to block transfers. Minting (from == address(0)) is allowed;
     *      burning and transfers are not.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) {
            // Token already exists — this is a transfer or burn, not a mint
            revert Soulbound();
        }
        return super._update(to, tokenId, auth);
    }

    /// @dev Disable all approvals.
    function approve(address, uint256) public pure override {
        revert Soulbound();
    }

    /// @dev Disable operator approvals.
    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }
}
