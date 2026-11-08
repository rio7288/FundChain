// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

contract FundChainV2 {
    uint256 public nextCampaignId = 1;
    uint256 public constant VOTING_DURATION = 3 days;
    uint256 public constant QUORUM_PERCENT = 20;

    enum MilestoneStatus { Pending, InReview, Approved, Rejected, Paid }

    struct Campaign {
        uint256 id;
        address payable creator;
        uint256 goal;
        uint256 deadline;
        uint256 totalRaised;
        // Contributions from addresses other than the campaign creator.
        // Only this amount is used to calculate milestone voting quorum.
        uint256 votingEligibleRaised;
        string metadataURI;
        uint256 milestoneCount;
        uint256 paidMilestones;
        bool exists;
        bool completed;
        bool failed;
        uint256 remainingFunds;
        uint256 refundPool;
        uint256 refundedContributionTotal;
        uint256 totalRefunded;
    }

    struct Milestone {
        string title;
        string description;
        uint256 amount;
        string evidenceURI;
        uint256 votingDeadline;
        uint256 votingRound;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 rejectionCount;
        MilestoneStatus status;
    }

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public contributions;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;
    mapping(uint256 => mapping(uint256 => mapping(uint256 => mapping(address => bool)))) public hasVoted;
    mapping(uint256 => mapping(address => bool)) public refundClaimed;

    uint256 private locked = 1;

    modifier nonReentrant() {
        require(locked == 1, "Reentrant call");
        locked = 2;
        _;
        locked = 1;
    }

    event CampaignCreated(uint256 indexed campaignId, address indexed creator, uint256 goal, uint256 deadline, uint256 milestoneCount);
    event DonationReceived(uint256 indexed campaignId, address indexed donor, uint256 amount);
    event MilestoneEvidenceSubmitted(uint256 indexed campaignId, uint256 indexed milestoneIndex, uint256 votingRound, string evidenceURI, uint256 votingDeadline);
    event MilestoneVoteCast(uint256 indexed campaignId, uint256 indexed milestoneIndex, address indexed voter, bool approved, uint256 votingPower);
    event MilestoneFinalized(uint256 indexed campaignId, uint256 indexed milestoneIndex, bool approved, uint256 yesVotes, uint256 noVotes);
    event MilestoneFundsReleased(uint256 indexed campaignId, uint256 indexed milestoneIndex, address indexed creator, uint256 amount);
    event CampaignCompleted(uint256 indexed campaignId);
    event CampaignFailed(uint256 indexed campaignId, uint256 refundableAmount);
    event RefundIssued(uint256 indexed campaignId, address indexed donor, uint256 amount);

    function createCampaign(
        uint256 _goal,
        uint256 _deadline,
        string calldata _metadataURI,
        uint256[] calldata _milestoneAmounts,
        string[] calldata _milestoneTitles,
        string[] calldata _milestoneDescriptions
    ) external returns (uint256) {
        require(_goal > 0, "Invalid goal");
        require(_deadline > block.timestamp, "Invalid deadline");
        require(_milestoneAmounts.length > 0, "Milestones required");
        require(
            _milestoneAmounts.length == _milestoneTitles.length &&
            _milestoneAmounts.length == _milestoneDescriptions.length,
            "Milestone arrays mismatch"
        );

        uint256 totalAllocation;
        for (uint256 i = 0; i < _milestoneAmounts.length; i++) {
            require(_milestoneAmounts[i] > 0, "Invalid milestone amount");
            totalAllocation += _milestoneAmounts[i];
        }
        require(totalAllocation == _goal, "Milestones must equal goal");

        uint256 campaignId = nextCampaignId++;
        campaigns[campaignId] = Campaign({
            id: campaignId,
            creator: payable(msg.sender),
            goal: _goal,
            deadline: _deadline,
            totalRaised: 0,
            votingEligibleRaised: 0,
            metadataURI: _metadataURI,
            milestoneCount: _milestoneAmounts.length,
            paidMilestones: 0,
            exists: true,
            completed: false,
            failed: false,
            remainingFunds: 0,
            refundPool: 0,
            refundedContributionTotal: 0,
            totalRefunded: 0
        });

        for (uint256 i = 0; i < _milestoneAmounts.length; i++) {
            milestones[campaignId][i] = Milestone({
                title: _milestoneTitles[i],
                description: _milestoneDescriptions[i],
                amount: _milestoneAmounts[i],
                evidenceURI: "",
                votingDeadline: 0,
                votingRound: 0,
                yesVotes: 0,
                noVotes: 0,
                rejectionCount: 0,
                status: MilestoneStatus.Pending
            });
        }

        emit CampaignCreated(campaignId, msg.sender, _goal, _deadline, _milestoneAmounts.length);
        return campaignId;
    }

    function donate(uint256 _campaignId) external payable {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.exists, "Campaign does not exist");
        require(!campaign.completed, "Campaign completed");
        require(!campaign.failed, "Campaign failed");
        require(block.timestamp < campaign.deadline, "Campaign ended");
        require(campaign.totalRaised < campaign.goal, "Goal reached");
        require(msg.value > 0, "Invalid donation");

        uint256 remaining = campaign.goal - campaign.totalRaised;
        require(msg.value <= remaining, "Donation exceeds remaining goal");

        campaign.totalRaised += msg.value;
        campaign.remainingFunds += msg.value;
        contributions[_campaignId][msg.sender] += msg.value;

        // Creator contributions count toward the funding goal and refunds,
        // but cannot increase the voting quorum because creators cannot vote.
        if (msg.sender != campaign.creator) {
            campaign.votingEligibleRaised += msg.value;
        }
        emit DonationReceived(_campaignId, msg.sender, msg.value);
    }

    function submitMilestoneEvidence(
        uint256 _campaignId,
        uint256 _milestoneIndex,
        string calldata _evidenceURI
    ) external {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.exists, "Campaign does not exist");
        require(!campaign.completed, "Campaign completed");
        require(!campaign.failed, "Campaign failed");
        require(msg.sender == campaign.creator, "Not campaign creator");
        require(campaign.totalRaised >= campaign.goal, "Campaign goal not reached");
        require(_milestoneIndex < campaign.milestoneCount, "Invalid milestone");
        require(_milestoneIndex == campaign.paidMilestones, "Previous milestone not paid");
        require(bytes(_evidenceURI).length > 0, "Evidence required");

        Milestone storage milestone = milestones[_campaignId][_milestoneIndex];
        require(milestone.status == MilestoneStatus.Pending || milestone.status == MilestoneStatus.Rejected, "Milestone cannot be submitted");
        require(milestone.rejectionCount < 2, "Resubmission limit reached");

        milestone.evidenceURI = _evidenceURI;
        milestone.votingDeadline = block.timestamp + VOTING_DURATION;
        milestone.votingRound++;
        milestone.yesVotes = 0;
        milestone.noVotes = 0;
        milestone.status = MilestoneStatus.InReview;

        emit MilestoneEvidenceSubmitted(_campaignId, _milestoneIndex, milestone.votingRound, _evidenceURI, milestone.votingDeadline);
    }

    function voteOnMilestone(uint256 _campaignId, uint256 _milestoneIndex, bool _approve) external {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.exists, "Campaign does not exist");
        require(!campaign.completed, "Campaign completed");
        require(!campaign.failed, "Campaign failed");
        require(_milestoneIndex < campaign.milestoneCount, "Invalid milestone");
        require(msg.sender != campaign.creator, "Creator cannot vote");

        Milestone storage milestone = milestones[_campaignId][_milestoneIndex];
        require(milestone.status == MilestoneStatus.InReview, "Milestone not under review");
        require(block.timestamp < milestone.votingDeadline, "Voting period ended");

        uint256 votingPower = contributions[_campaignId][msg.sender];
        require(votingPower > 0, "Only donors can vote");
        require(!hasVoted[_campaignId][_milestoneIndex][milestone.votingRound][msg.sender], "Already voted");

        hasVoted[_campaignId][_milestoneIndex][milestone.votingRound][msg.sender] = true;
        if (_approve) {
            milestone.yesVotes += votingPower;
        } else {
            milestone.noVotes += votingPower;
        }
        emit MilestoneVoteCast(_campaignId, _milestoneIndex, msg.sender, _approve, votingPower);
    }

    function finalizeMilestone(uint256 _campaignId, uint256 _milestoneIndex) external {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.exists, "Campaign does not exist");
        require(!campaign.completed, "Campaign completed");
        require(!campaign.failed, "Campaign failed");
        require(_milestoneIndex < campaign.milestoneCount, "Invalid milestone");

        Milestone storage milestone = milestones[_campaignId][_milestoneIndex];
        require(milestone.status == MilestoneStatus.InReview, "Milestone not under review");
        require(block.timestamp >= milestone.votingDeadline, "Voting still active");

        uint256 votesCast = milestone.yesVotes + milestone.noVotes;

        // Calculate ceil(votingEligibleRaised * QUORUM_PERCENT / 100)
        // without multiplying the full contribution total (avoids overflow).
        uint256 eligibleRaised = campaign.votingEligibleRaised;
        uint256 quorumRequired =
            (eligibleRaised / 100) * QUORUM_PERCENT +
            (((eligibleRaised % 100) * QUORUM_PERCENT + 99) / 100);

        // A campaign funded only by its creator has no eligible voting base
        // and therefore cannot pass a milestone without eligible donor votes.
        bool quorumReached = eligibleRaised > 0 && votesCast >= quorumRequired;
        bool approved = quorumReached && milestone.yesVotes > milestone.noVotes;

        if (approved) {
            milestone.status = MilestoneStatus.Approved;
        } else {
            milestone.status = MilestoneStatus.Rejected;
            milestone.rejectionCount++;

            // A second rejection ends the campaign and freezes the remaining refund pool.
            if (milestone.rejectionCount >= 2) {
                campaign.failed = true;
                campaign.refundPool = campaign.remainingFunds;
                emit CampaignFailed(_campaignId, campaign.refundPool);
            }
        }

        emit MilestoneFinalized(_campaignId, _milestoneIndex, approved, milestone.yesVotes, milestone.noVotes);
    }

    function releaseMilestoneFunds(uint256 _campaignId, uint256 _milestoneIndex) external nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.exists, "Campaign does not exist");
        require(!campaign.completed, "Campaign completed");
        require(!campaign.failed, "Campaign failed");
        require(_milestoneIndex < campaign.milestoneCount, "Invalid milestone");
        require(_milestoneIndex == campaign.paidMilestones, "Previous milestone not paid");

        Milestone storage milestone = milestones[_campaignId][_milestoneIndex];
        require(milestone.status == MilestoneStatus.Approved, "Milestone not approved");

        uint256 amount = milestone.amount;
        require(campaign.remainingFunds >= amount, "Insufficient campaign balance");

        milestone.status = MilestoneStatus.Paid;
        campaign.paidMilestones++;
        campaign.remainingFunds -= amount;

        (bool success, ) = campaign.creator.call{value: amount}("");
        require(success, "Transfer failed");

        emit MilestoneFundsReleased(_campaignId, _milestoneIndex, campaign.creator, amount);

        if (campaign.paidMilestones == campaign.milestoneCount) {
            campaign.completed = true;
            emit CampaignCompleted(_campaignId);
        }
    }

    function claimRefund(uint256 _campaignId) external nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.exists, "Campaign does not exist");

        // An underfunded campaign becomes refundable after its deadline.
        if (!campaign.failed) {
            require(block.timestamp >= campaign.deadline, "Campaign not ended");
            require(campaign.totalRaised < campaign.goal, "Goal was reached");
            campaign.failed = true;
            campaign.refundPool = campaign.remainingFunds;
            emit CampaignFailed(_campaignId, campaign.refundPool);
        }

        require(!campaign.completed, "Campaign completed");
        require(!refundClaimed[_campaignId][msg.sender], "Refund already claimed");

        uint256 contribution = contributions[_campaignId][msg.sender];
        require(contribution > 0, "No contribution to refund");

        // Allocate refunds cumulatively so all rounding dust is accounted for
        // when every contributor has claimed. A donor may legitimately receive
        // zero wei when their proportional share is smaller than one wei.
        uint256 previousClaimed = campaign.refundedContributionTotal;
        uint256 newClaimed = previousClaimed + contribution;
        require(newClaimed <= campaign.totalRaised, "Refund contributions exceed raised amount");

        uint256 amount =
            (campaign.refundPool * newClaimed) / campaign.totalRaised -
            (campaign.refundPool * previousClaimed) / campaign.totalRaised;
        require(campaign.totalRefunded + amount <= campaign.refundPool, "Refund exceeds pool");

        refundClaimed[_campaignId][msg.sender] = true;
        campaign.refundedContributionTotal = newClaimed;
        campaign.totalRefunded += amount;
        campaign.remainingFunds -= amount;
        contributions[_campaignId][msg.sender] = 0;

        // Avoid making an unnecessary zero-value external call.
        if (amount > 0) {
            (bool success, ) = payable(msg.sender).call{value: amount}("");
            require(success, "Refund failed");
        }

        emit RefundIssued(_campaignId, msg.sender, amount);
    }

    function getMilestone(uint256 _campaignId, uint256 _milestoneIndex) external view returns (Milestone memory) {
        require(campaigns[_campaignId].exists, "Campaign does not exist");
        require(_milestoneIndex < campaigns[_campaignId].milestoneCount, "Invalid milestone");
        return milestones[_campaignId][_milestoneIndex];
    }

    function getMilestoneCount(uint256 _campaignId) external view returns (uint256) {
        require(campaigns[_campaignId].exists, "Campaign does not exist");
        return campaigns[_campaignId].milestoneCount;
    }

    function getCampaignProgress(uint256 _campaignId) external view returns (
        uint256 totalRaised,
        uint256 goal,
        uint256 paidMilestones,
        uint256 milestoneCount,
        bool completed
    ) {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.exists, "Campaign does not exist");
        return (campaign.totalRaised, campaign.goal, campaign.paidMilestones, campaign.milestoneCount, campaign.completed);
    }
}
