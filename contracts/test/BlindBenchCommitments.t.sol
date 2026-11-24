// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {BlindBenchCommitments} from "../src/BlindBenchCommitments.sol";

contract BlindBenchCommitmentsTest {
    bytes32 constant STUDY = bytes32(uint256(1));
    bytes32 constant POLICY = bytes32(uint256(2));
    bytes32 constant RESULT = bytes32(uint256(3));
    bytes32 constant OTHER_DIGEST = bytes32(uint256(4));

    function testCommitmentsAreIdempotentAndImmutable() external {
        BlindBenchCommitments ledger = new BlindBenchCommitments(address(this));
        ledger.commitStudy(STUDY, POLICY);
        ledger.commitStudy(STUDY, POLICY);
        assert(!attempt(ledger, abi.encodeCall(ledger.commitStudy, (STUDY, OTHER_DIGEST))));
        assert(!attempt(ledger, abi.encodeCall(ledger.commitResult, (STUDY, RESULT))));
        ledger.sealStudy(STUDY);
        ledger.sealStudy(STUDY);
        ledger.commitResult(STUDY, RESULT);
        ledger.commitResult(STUDY, RESULT);
        assert(!attempt(ledger, abi.encodeCall(ledger.commitResult, (STUDY, OTHER_DIGEST))));
        assert(!attempt(ledger, abi.encodeCall(ledger.abortStudy, (STUDY))));
        (bytes32 policy, bytes32 result, BlindBenchCommitments.State state) = ledger.commitments(STUDY);
        assert(policy == POLICY && result == RESULT && state == BlindBenchCommitments.State.Published);
    }

    function testAbortedStudyCannotPublish() external {
        BlindBenchCommitments ledger = new BlindBenchCommitments(address(this));
        ledger.commitStudy(STUDY, POLICY);
        ledger.abortStudy(STUDY);
        ledger.abortStudy(STUDY);
        assert(!attempt(ledger, abi.encodeCall(ledger.sealStudy, (STUDY))));
        assert(!attempt(ledger, abi.encodeCall(ledger.commitResult, (STUDY, RESULT))));
        (, bytes32 result, BlindBenchCommitments.State state) = ledger.commitments(STUDY);
        assert(result == 0 && state == BlindBenchCommitments.State.Aborted);
    }

    function testOnlyOperatorCanWriteAndZerosAreRejected() external {
        BlindBenchCommitments other = new BlindBenchCommitments(address(0x1234));
        assert(!attempt(other, abi.encodeCall(other.commitStudy, (STUDY, POLICY))));
        BlindBenchCommitments ledger = new BlindBenchCommitments(address(this));
        assert(!attempt(ledger, abi.encodeCall(ledger.commitStudy, (bytes32(0), POLICY))));
        assert(!attempt(ledger, abi.encodeCall(ledger.commitStudy, (STUDY, bytes32(0)))));
    }

    function attempt(BlindBenchCommitments ledger, bytes memory callData) private returns (bool ok) {
        (ok,) = address(ledger).call(callData);
    }
}
