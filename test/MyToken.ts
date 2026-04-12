import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { parseEther, BaseError, ContractFunctionRevertedError, ContractFunctionExecutionError } from "viem";

function assertContractRevert(error: unknown, expectedErrorName: string) {
  assert.ok(error instanceof BaseError, "Expected a BaseError from viem");
  const revertError = error.walk(
    (e) => e instanceof ContractFunctionRevertedError
  ) as ContractFunctionRevertedError | null;
  if (revertError?.data?.errorName) {
    assert.equal(revertError.data.errorName, expectedErrorName);
  } else {
    // Fallback: check the error message contains the custom error name
    assert.ok(
      error.message.includes(expectedErrorName),
      `Expected error to contain "${expectedErrorName}", got: ${error.message}`
    );
  }
}

describe("MyToken", function () {
  async function deployToken() {
    const { viem } = await network.connect();
    const [walletClient, otherClient] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();

    const initialSupply = parseEther("1000000");
    const myToken = await viem.deployContract("MyToken", [initialSupply]);

    return { myToken, walletClient, otherClient, publicClient, initialSupply };
  }

  describe("Deployment", function () {
    it("Should deploy with correct name and symbol", async function () {
      const { myToken } = await deployToken();

      assert.equal(await myToken.read.name(), "MyToken");
      assert.equal(await myToken.read.symbol(), "MTK");
    });

    it("Should assign the initial supply to the deployer", async function () {
      const { myToken, walletClient, initialSupply } = await deployToken();

      const balance = await myToken.read.balanceOf([walletClient.account.address]);
      assert.equal(balance, initialSupply);
    });

    it("Should set the deployer as owner", async function () {
      const { myToken, walletClient } = await deployToken();

      const owner = await myToken.read.owner();
      assert.equal(owner.toLowerCase(), walletClient.account.address.toLowerCase());
    });
  });

  describe("Minting", function () {
    it("Owner should be able to mint tokens", async function () {
      const { myToken, otherClient } = await deployToken();
      const mintAmount = parseEther("500");

      await myToken.write.mint([otherClient.account.address, mintAmount]);

      const balance = await myToken.read.balanceOf([otherClient.account.address]);
      assert.equal(balance, mintAmount);
    });

    it("Non-owner should NOT be able to mint tokens", async function () {
      const { myToken, otherClient } = await deployToken();
      const mintAmount = parseEther("500");

      await assert.rejects(
        () => myToken.write.mint([otherClient.account.address, mintAmount], {
          account: otherClient.account,
        }),
        (error: unknown) => {
          assertContractRevert(error, "OwnableUnauthorizedAccount");
          return true;
        }
      );
    });
  });

  describe("Transfers", function () {
    it("Should transfer tokens between accounts", async function () {
      const { myToken, walletClient, otherClient } = await deployToken();
      const transferAmount = parseEther("100");

      await myToken.write.transfer([otherClient.account.address, transferAmount]);

      const senderBalance = await myToken.read.balanceOf([walletClient.account.address]);
      const receiverBalance = await myToken.read.balanceOf([otherClient.account.address]);

      assert.equal(receiverBalance, transferAmount);
      assert.equal(senderBalance, parseEther("999900"));
    });

    it("Should fail when transferring more than balance", async function () {
      const { myToken, walletClient, otherClient } = await deployToken();
      const tooMuch = parseEther("1000001"); // more than initial supply

      await assert.rejects(
        () => myToken.write.transfer([otherClient.account.address, tooMuch]),
        (error: unknown) => {
          assertContractRevert(error, "ERC20InsufficientBalance");
          return true;
        }
      );
    });

    it("Should update balances after multiple transfers", async function () {
      const { myToken, walletClient, otherClient } = await deployToken();

      await myToken.write.transfer([otherClient.account.address, parseEther("100")]);

      await myToken.write.transfer([walletClient.account.address, parseEther("50")], {
        account: otherClient.account,
      });

      const deployerBalance = await myToken.read.balanceOf([walletClient.account.address]);
      const otherBalance = await myToken.read.balanceOf([otherClient.account.address]);

      assert.equal(deployerBalance, parseEther("999950"));
      assert.equal(otherBalance, parseEther("50"));
    });
  });

  describe("Balance checks", function () {
    it("Should return zero balance for addresses with no tokens", async function () {
      const { myToken, otherClient } = await deployToken();

      const balance = await myToken.read.balanceOf([otherClient.account.address]);
      assert.equal(balance, 0n);
    });

    it("Total supply should increase after minting", async function () {
      const { myToken, walletClient, initialSupply } = await deployToken();
      const mintAmount = parseEther("5000");

      await myToken.write.mint([walletClient.account.address, mintAmount]);

      const totalSupply = await myToken.read.totalSupply();
      assert.equal(totalSupply, initialSupply + mintAmount);
    });
  });
});
