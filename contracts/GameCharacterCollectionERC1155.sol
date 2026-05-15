// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title GameCharacterCollectionERC1155
 * @notice ERC-1155 collection of 10 unique game characters. Supports batch minting
 *         and batch transfers. Metadata is stored fully on-chain.
 */
contract GameCharacterCollectionERC1155 is ERC1155, Ownable {
    using Strings for uint256;

    // -------------------------------------------------------------------------
    // Constants — 10 character token IDs
    // -------------------------------------------------------------------------

    uint256 public constant WARRIOR    = 1;
    uint256 public constant MAGE       = 2;
    uint256 public constant ROGUE      = 3;
    uint256 public constant PALADIN    = 4;
    uint256 public constant RANGER     = 5;
    uint256 public constant NECROMANCER = 6;
    uint256 public constant BERSERKER  = 7;
    uint256 public constant PRIEST     = 8;
    uint256 public constant DRUID      = 9;
    uint256 public constant MONK       = 10;

    uint256 public constant TOTAL_CHARACTERS = 10;

    // -------------------------------------------------------------------------
    // Character metadata stored on-chain
    // -------------------------------------------------------------------------

    struct Character {
        string name;
        string color;      // primary color hex
        uint8  speed;      // 1-100
        uint8  strength;   // 1-100
        string rarity;     // Common / Rare / Epic / Legendary
        string emoji;      // visual icon for SVG
    }

    // tokenId => Character
    mapping(uint256 => Character) private _characters;

    string public name = "Game Character Collection";
    string public symbol = "GCC";

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event CharactersMinted(address indexed to, uint256[] ids, uint256[] amounts);
    event BatchTransferred(address indexed from, address indexed to, uint256[] ids, uint256[] amounts);

    // -------------------------------------------------------------------------
    // Constructor — register all 10 characters
    // -------------------------------------------------------------------------

    constructor() ERC1155("") Ownable(msg.sender) {
        _initCharacters();
    }

    function _initCharacters() internal {
        _characters[WARRIOR]     = Character("Warrior",     "#c0392b", 55, 90, "Rare",      unicode"⚔️");
        _characters[MAGE]        = Character("Mage",        "#8e44ad", 60, 75, "Epic",      unicode"🔮");
        _characters[ROGUE]       = Character("Rogue",       "#27ae60", 95, 60, "Rare",      unicode"🗡️");
        _characters[PALADIN]     = Character("Paladin",     "#f39c12", 45, 85, "Epic",      unicode"🛡️");
        _characters[RANGER]      = Character("Ranger",      "#16a085", 80, 65, "Common",    unicode"🏹");
        _characters[NECROMANCER] = Character("Necromancer", "#2c3e50", 50, 80, "Legendary", unicode"💀");
        _characters[BERSERKER]   = Character("Berserker",   "#e74c3c", 70, 99, "Epic",      unicode"🪓");
        _characters[PRIEST]      = Character("Priest",      "#bdc3c7", 40, 50, "Common",    unicode"✨");
        _characters[DRUID]       = Character("Druid",       "#2ecc71", 65, 70, "Rare",      unicode"🌿");
        _characters[MONK]        = Character("Monk",        "#e67e22", 88, 78, "Legendary", unicode"☯️");
    }

    // -------------------------------------------------------------------------
    // Minting (owner only)
    // -------------------------------------------------------------------------

    /**
     * @notice Batch mint all 10 characters at once to a recipient.
     * @param to      Recipient address.
     * @param amounts Array of 10 amounts corresponding to token IDs 1-10.
     */
    function batchMintAll(address to, uint256[10] calldata amounts) external onlyOwner {
        uint256[] memory ids = _allIds();
        uint256[] memory amts = new uint256[](TOTAL_CHARACTERS);
        for (uint256 i = 0; i < TOTAL_CHARACTERS; i++) {
            amts[i] = amounts[i];
        }
        _mintBatch(to, ids, amts, "");
        emit CharactersMinted(to, ids, amts);
    }

    /**
     * @notice Mint specific token IDs with given amounts.
     * @param to      Recipient address.
     * @param ids     Array of token IDs.
     * @param amounts Array of amounts per token ID.
     */
    function batchMint(
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external onlyOwner {
        for (uint256 i = 0; i < ids.length; i++) {
            require(ids[i] >= 1 && ids[i] <= TOTAL_CHARACTERS, "Invalid character ID");
        }
        _mintBatch(to, ids, amounts, "");
        emit CharactersMinted(to, ids, amounts);
    }

    /**
     * @notice Mint a single character token.
     */
    function mintCharacter(address to, uint256 id, uint256 amount) external onlyOwner {
        require(id >= 1 && id <= TOTAL_CHARACTERS, "Invalid character ID");
        _mint(to, id, amount, "");
    }

    // -------------------------------------------------------------------------
    // Batch transfer helper (demonstrate ERC-1155 batch efficiency)
    // -------------------------------------------------------------------------

    /**
     * @notice Transfer multiple character tokens in a single transaction.
     */
    function batchTransfer(
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external {
        safeBatchTransferFrom(msg.sender, to, ids, amounts, "");
        emit BatchTransferred(msg.sender, to, ids, amounts);
    }

    // -------------------------------------------------------------------------
    // Metadata — fully on-chain per token ID
    // -------------------------------------------------------------------------

    function uri(uint256 tokenId) public view override returns (string memory) {
        require(tokenId >= 1 && tokenId <= TOTAL_CHARACTERS, "Invalid token ID");
        Character memory c = _characters[tokenId];

        string memory svg = _buildSVG(c, tokenId);
        string memory imageURI = string(
            abi.encodePacked(
                "data:image/svg+xml;base64,",
                Base64.encode(bytes(svg))
            )
        );

        string memory json = string(
            abi.encodePacked(
                '{"name":"', c.name, ' #', tokenId.toString(), '",',
                '"description":"A game character NFT from the Game Character Collection.",',
                '"image":"', imageURI, '",',
                '"attributes":[',
                    '{"trait_type":"Color","value":"', c.color, '"},',
                    '{"trait_type":"Speed","value":', uint256(c.speed).toString(), '},',
                    '{"trait_type":"Strength","value":', uint256(c.strength).toString(), '},',
                    '{"trait_type":"Rarity","value":"', c.rarity, '"}',
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

    function _buildSVG(Character memory c, uint256 tokenId) internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" width="350" height="350" viewBox="0 0 350 350">',
                '<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">',
                '<stop offset="0%" style="stop-color:#0d0d0d;stop-opacity:1"/>',
                '<stop offset="100%" style="stop-color:#1a1a1a;stop-opacity:1"/>',
                '</linearGradient></defs>',
                '<rect width="350" height="350" rx="18" fill="url(#bg)"/>',
                '<rect x="4" y="4" width="342" height="342" rx="15" fill="none" stroke="', c.color, '" stroke-width="3"/>',
                '<circle cx="175" cy="120" r="70" fill="', c.color, '" opacity="0.15"/>',
                '<circle cx="175" cy="120" r="55" fill="', c.color, '" opacity="0.25"/>',
                '<text x="175" y="138" text-anchor="middle" font-size="52" font-family="serif">', c.emoji, '</text>',
                '<text x="175" y="215" text-anchor="middle" font-size="22" fill="white" font-family="monospace" font-weight="bold">', c.name, '</text>',
                '<rect x="20" y="228" width="310" height="1" fill="', c.color, '" opacity="0.5"/>',
                '<text x="35" y="254" font-size="11" fill="#888" font-family="monospace">SPEED</text>',
                '<text x="35" y="272" font-size="16" fill="', c.color, '" font-family="monospace" font-weight="bold">', uint256(c.speed).toString(), '</text>',
                '<text x="130" y="254" font-size="11" fill="#888" font-family="monospace">STRENGTH</text>',
                '<text x="130" y="272" font-size="16" fill="', c.color, '" font-family="monospace" font-weight="bold">', uint256(c.strength).toString(), '</text>',
                '<text x="245" y="254" font-size="11" fill="#888" font-family="monospace">RARITY</text>',
                '<text x="245" y="272" font-size="13" fill="', c.color, '" font-family="monospace" font-weight="bold">', c.rarity, '</text>',
                '<text x="175" y="318" text-anchor="middle" font-size="11" fill="#555" font-family="monospace">GAME CHARACTER COLLECTION #', tokenId.toString(), '</text>',
                '</svg>'
            )
        );
    }

    // -------------------------------------------------------------------------
    // Read helpers
    // -------------------------------------------------------------------------

    function getCharacter(uint256 tokenId) external view returns (Character memory) {
        require(tokenId >= 1 && tokenId <= TOTAL_CHARACTERS, "Invalid token ID");
        return _characters[tokenId];
    }

    function _allIds() internal pure returns (uint256[] memory ids) {
        ids = new uint256[](10);
        for (uint256 i = 0; i < 10; i++) {
            ids[i] = i + 1;
        }
    }
}
