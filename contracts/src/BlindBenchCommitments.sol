// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

contract BlindBenchCommitments {
    enum State { None, Committed, Sealed, Published, Aborted }

    struct Study {
        bytes32 policyDigest;
        bytes32 resultDigest;
        State state;
    }

    address public immutable operator;
    mapping(bytes32 => Study) private studies;

    error Unauthorized();
    error InvalidCommitment();
    error InvalidState();

    event StudyCommitted(bytes32 indexed study, bytes32 policyDigest);
    event StudySealed(bytes32 indexed study);
    event StudyAborted(bytes32 indexed study);
    event ResultCommitted(bytes32 indexed study, bytes32 resultDigest);

    constructor(address operator_) {
        if (operator_ == address(0)) revert Unauthorized();
        operator = operator_;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert Unauthorized();
        _;
    }

    function commitStudy(bytes32 study, bytes32 policyDigest) external onlyOperator {
        if (study == 0 || policyDigest == 0) revert InvalidCommitment();
        Study storage current = studies[study];
        if (current.state != State.None) {
            if (current.policyDigest == policyDigest) return;
            revert InvalidState();
        }
        studies[study] = Study(policyDigest, 0, State.Committed);
        emit StudyCommitted(study, policyDigest);
    }

    function sealStudy(bytes32 study) external onlyOperator {
        Study storage current = studies[study];
        if (current.state == State.Sealed || current.state == State.Published) return;
        if (current.state != State.Committed) revert InvalidState();
        current.state = State.Sealed;
        emit StudySealed(study);
    }

    function abortStudy(bytes32 study) external onlyOperator {
        Study storage current = studies[study];
        if (current.state == State.Aborted) return;
        if (current.state != State.Committed && current.state != State.Sealed) revert InvalidState();
        current.state = State.Aborted;
        emit StudyAborted(study);
    }

    function commitResult(bytes32 study, bytes32 resultDigest) external onlyOperator {
        if (resultDigest == 0) revert InvalidCommitment();
        Study storage current = studies[study];
        if (current.state == State.Published && current.resultDigest == resultDigest) return;
        if (current.state != State.Sealed) revert InvalidState();
        current.resultDigest = resultDigest;
        current.state = State.Published;
        emit ResultCommitted(study, resultDigest);
    }

    function commitments(bytes32 study) external view returns (bytes32 policyDigest, bytes32 resultDigest, State state) {
        Study storage current = studies[study];
        return (current.policyDigest, current.resultDigest, current.state);
    }
}
