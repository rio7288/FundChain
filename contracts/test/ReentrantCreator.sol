// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

// Test helper: behaves as a campaign creator and attempts a reentrant
// milestone release when it receives ETH.
interface IFundChainReentryTarget {
    function createCampaign(
        uint256 goal,
        uint256 deadline,
        string calldata metadataURI,
        uint256[] calldata milestoneAmounts,
        string[] calldata milestoneTitles,
        string[] calldata milestoneDescriptions
    ) external returns (uint256);

    function submitMilestoneEvidence(
        uint256 campaignId,
        uint256 milestoneIndex,
        string calldata evidenceURI
    ) external;

    function releaseMilestoneFunds(
        uint256 campaignId,
        uint256 milestoneIndex
    ) external;
}

contract ReentrantCreator {
    IFundChainReentryTarget public immutable fundChain;
    uint256 public campaignId;
    bool public attemptedReentry;
    bool public reentrySucceeded;

    constructor(address fundChainAddress) {
        fundChain = IFundChainReentryTarget(fundChainAddress);
    }

    function createCampaign(
        uint256 goal,
        uint256 deadline,
        string calldata metadataURI,
        uint256[] calldata milestoneAmounts,
        string[] calldata milestoneTitles,
        string[] calldata milestoneDescriptions
    ) external {
        campaignId = fundChain.createCampaign(
            goal,
            deadline,
            metadataURI,
            milestoneAmounts,
            milestoneTitles,
            milestoneDescriptions
        );
    }

    function submitEvidence(
        uint256 _campaignId,
        uint256 milestoneIndex,
        string calldata evidenceURI
    ) external {
        fundChain.submitMilestoneEvidence(
            _campaignId,
            milestoneIndex,
            evidenceURI
        );
    }

    receive() external payable {
        attemptedReentry = true;
        (reentrySucceeded, ) = address(fundChain).call(
            abi.encodeWithSelector(
                IFundChainReentryTarget.releaseMilestoneFunds.selector,
                campaignId,
                0
            )
        );
    }
}
