import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import {
  BaseError,
  ContractFunctionRevertedError,
} from "viem";

function assertContractRevert(error: unknown, expectedErrorName: string) {
  assert.ok(error instanceof BaseError, "Expected a BaseError from viem");
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

describe("SoulboundVisitCardERC721", function () {
  async function deployVisitCard() {
    const { viem } = await network.connect();
    const [owner, student, other] = await viem.getWalletClients();

    const visitCard = await viem.deployContract("SoulboundVisitCardERC721");

    return { visitCard, owner, student, other };
  }

  it("mints exactly one card per student", async function () {
    const { visitCard, student } = await deployVisitCard();

    await visitCard.write.mintVisitCard([
      student.account.address,
      "Vladyslav",
      "STU-2024-047",
      "Blockchain & Cryptography",
      "2024",
    ]);

    assert.equal(
      (await visitCard.read.ownerOf([1n])).toLowerCase(),
      student.account.address.toLowerCase()
    );

    await assert.rejects(
      () =>
        visitCard.write.mintVisitCard([
          student.account.address,
          "Vladyslav",
          "STU-2024-047",
          "Blockchain & Cryptography",
          "2024",
        ]),
      (error: unknown) => {
        assertContractRevert(error, "AlreadyMinted");
        return true;
      }
    );
  });

  it("blocks transfer attempts from the token owner", async function () {
    const { visitCard, student, other } = await deployVisitCard();

    await visitCard.write.mintVisitCard([
      student.account.address,
      "Vladyslav",
      "STU-2024-047",
      "Blockchain & Cryptography",
      "2024",
    ]);

    await assert.rejects(
      () =>
        visitCard.write.transferFrom(
          [student.account.address, other.account.address, 1n],
          { account: student.account }
        ),
      (error: unknown) => {
        assertContractRevert(error, "Soulbound");
        return true;
      }
    );
  });

  it("blocks approvals", async function () {
    const { visitCard, student, other } = await deployVisitCard();

    await visitCard.write.mintVisitCard([
      student.account.address,
      "Vladyslav",
      "STU-2024-047",
      "Blockchain & Cryptography",
      "2024",
    ]);

    await assert.rejects(
      () => visitCard.write.approve([other.account.address, 1n], { account: student.account }),
      (error: unknown) => {
        assertContractRevert(error, "Soulbound");
        return true;
      }
    );
  });
});