import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import {
  BaseError,
  ContractFunctionRevertedError,
} from "viem";

function assertContractRevert(error: unknown, expectedErrorName?: string) {
  assert.ok(error instanceof BaseError, "Expected a BaseError from viem");

  if (expectedErrorName === undefined) {
    return;
  }

  const revertError = error.walk(
    (e) => e instanceof ContractFunctionRevertedError
  ) as ContractFunctionRevertedError | null;

  if (revertError?.data?.errorName) {
    assert.equal(revertError.data.errorName, expectedErrorName);
  } else {
    assert.ok(
      error.message.includes(expectedErrorName),
      `Expected error to contain "${expectedErrorName}", got: ${error.message}`
    );
  }
}

describe("GameCharacterCollectionERC1155", function () {
  async function deployCollection() {
    const { viem } = await network.connect();
    const [owner, receiver] = await viem.getWalletClients();

    const collection = await viem.deployContract("GameCharacterCollectionERC1155");

    return { collection, owner, receiver };
  }

  it("batch mints all 10 character ids", async function () {
    const { collection, owner } = await deployCollection();

    await collection.write.batchMintAll([
      owner.account.address,
      [1n, 1n, 1n, 1n, 1n, 1n, 1n, 1n, 1n, 1n],
    ]);

    for (let i = 1; i <= 10; i++) {
      const balance = await collection.read.balanceOf([owner.account.address, BigInt(i)]);
      assert.equal(balance, 1n);
    }
  });

  it("supports batch transfer to another wallet", async function () {
    const { collection, owner, receiver } = await deployCollection();

    await collection.write.batchMintAll([
      owner.account.address,
      [1n, 1n, 1n, 1n, 1n, 1n, 1n, 1n, 1n, 1n],
    ]);

    await collection.write.safeBatchTransferFrom([
      owner.account.address,
      receiver.account.address,
      [1n, 2n],
      [1n, 1n],
      "0x",
    ]);

    assert.equal(await collection.read.balanceOf([receiver.account.address, 1n]), 1n);
    assert.equal(await collection.read.balanceOf([receiver.account.address, 2n]), 1n);
    assert.equal(await collection.read.balanceOf([owner.account.address, 1n]), 0n);
    assert.equal(await collection.read.balanceOf([owner.account.address, 2n]), 0n);
  });

  it("reverts uri() for an invalid token id", async function () {
    const { collection } = await deployCollection();

    await assert.rejects(
      () => collection.read.uri([11n]),
      (error: unknown) => {
        assertContractRevert(error);
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes("Invalid token ID"));
        return true;
      }
    );
  });
});