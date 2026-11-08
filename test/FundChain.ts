import { expect } from "chai";
import { describe, it } from "mocha";
import hre from "hardhat";

const { ethers, networkHelpers } = await hre.network.create();

describe("FundChain - Milestone Crowdfunding", function () {

    const ETH = ethers.parseEther;

    async function deployFundChain() {
        const [
            creator,
            donor1,
            donor2,
            outsider
        ] = await ethers.getSigners();

        const fundChain = await ethers.deployContract("FundChain");

        return {
            fundChain,
            creator,
            donor1,
            donor2,
            outsider
        };
    }

    async function createCampaign(
        fundChain: any,
        goal = ETH("2"),
        milestoneAmounts = [ETH("1"), ETH("1")]
    ) {
        const latestBlock = await ethers.provider.getBlock("latest");
        const deadline = BigInt(latestBlock!.timestamp + 86400 * 7);

        const titles = milestoneAmounts.map(
            (_, index) => `Milestone ${index + 1}`
        );

        const descriptions = milestoneAmounts.map(
            (_, index) => `Description ${index + 1}`
        );

        await fundChain.createCampaign(
            goal,
            deadline,
            "ipfs://campaign-1",
            milestoneAmounts,
            titles,
            descriptions
        );

        return deadline;
    }

    async function fundCampaign(
        fundChain: any,
        donor1: any,
        donor2: any
    ) {
        await fundChain.connect(donor1).donate(1, {
            value: ETH("1")
        });

        await fundChain.connect(donor2).donate(1, {
            value: ETH("1")
        });
    }

    async function submitEvidence(
        fundChain: any,
        creator: any,
        milestoneIndex = 0
    ) {
        return fundChain.connect(creator).submitMilestoneEvidence(
            1,
            milestoneIndex,
            "ipfs://evidence-1"
        );
    }

    async function finishVoting(
        fundChain: any,
        milestoneIndex = 0
    ) {
        const milestone = await fundChain.getMilestone(
            1,
            milestoneIndex
        );

        await networkHelpers.time.increaseTo(
            milestone.votingDeadline
        );
    }

    // TEST 1: Campaign creation
    it("Should create a campaign with milestones", async function () {
        const { fundChain, creator } = await deployFundChain();

        await createCampaign(fundChain);

        const campaign = await fundChain.campaigns(1);
        const milestone = await fundChain.getMilestone(1, 0);

        expect(campaign.creator).to.equal(creator.address);
        expect(campaign.goal).to.equal(ETH("2"));
        expect(campaign.id).to.equal(1n);
        expect(campaign.milestoneCount).to.equal(2n);

        expect(milestone.title).to.equal("Milestone 1");
        expect(milestone.amount).to.equal(ETH("1"));
    });

    // TEST 2: Invalid milestone allocation
    it("Should reject milestone allocations that do not equal the campaign goal", async function () {
        const { fundChain } = await deployFundChain();

        await expect(
            createCampaign(
                fundChain,
                ETH("2"),
                [ETH("0.5"), ETH("0.5")]
            )
        ).to.be.revertedWith("Milestones must equal goal");
    });

    // TEST 3: ETH donations
    it("Should accept ETH donations and track individual contributions", async function () {
        const { fundChain, donor1 } = await deployFundChain();

        await createCampaign(fundChain);

        await fundChain.connect(donor1).donate(1, {
            value: ETH("1")
        });

        const campaign = await fundChain.campaigns(1);

        expect(campaign.totalRaised).to.equal(ETH("1"));

        expect(
            await fundChain.contributions(1, donor1.address)
        ).to.equal(ETH("1"));
    });

    // TEST 4: Donation exceeds goal
    it("Should prevent donations exceeding the remaining goal", async function () {
        const { fundChain, donor1 } = await deployFundChain();

        await createCampaign(fundChain);

        await fundChain.connect(donor1).donate(1, {
            value: ETH("1.8")
        });

        await expect(
            fundChain.connect(donor1).donate(1, {
                value: ETH("0.3")
            })
        ).to.be.revertedWith("Donation exceeds remaining goal");
    });

    // TEST 5: Evidence submission
    it("Should allow the creator to submit milestone evidence", async function () {
        const {
            fundChain,
            creator,
            donor1,
            donor2
        } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);

        await expect(
            submitEvidence(fundChain, creator)
        ).to.emit(fundChain, "MilestoneEvidenceSubmitted");

        const milestone = await fundChain.getMilestone(1, 0);

        expect(milestone.evidenceURI).to.equal("ipfs://evidence-1");
        expect(milestone.status).to.equal(1n);
        expect(milestone.votingRound).to.equal(1n);
    });

    // TEST 6: Non-creator cannot submit evidence
    it("Should prevent non-creators from submitting evidence", async function () {
        const {
            fundChain,
            creator,
            donor1,
            donor2
        } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);

        await expect(
            submitEvidence(fundChain, donor1)
        ).to.be.revertedWith("Not campaign creator");
    });

    // TEST 7: Creator cannot vote
    it("Should prevent the campaign creator from voting", async function () {
        const {
            fundChain,
            creator,
            donor1,
            donor2
        } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);
        await submitEvidence(fundChain, creator);

        await expect(
            fundChain.connect(creator).voteOnMilestone(1, 0, true)
        ).to.be.revertedWith("Creator cannot vote");
    });

    // TEST 8: Only donors can vote
    it("Should prevent non-donors from voting", async function () {
        const {
            fundChain,
            creator,
            donor1,
            donor2,
            outsider
        } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);
        await submitEvidence(fundChain, creator);

        await expect(
            fundChain.connect(outsider).voteOnMilestone(1, 0, true)
        ).to.be.revertedWith("Only donors can vote");
    });

    // TEST 9: Voting power is proportional to contribution
    it("Should use the donor's contribution as voting power", async function () {
        const {
            fundChain,
            creator,
            donor1,
            donor2
        } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);
        await submitEvidence(fundChain, creator);

        await fundChain.connect(donor1).voteOnMilestone(1, 0, true);

        const milestone = await fundChain.getMilestone(1, 0);

        expect(milestone.yesVotes).to.equal(ETH("1"));
        expect(milestone.noVotes).to.equal(0n);
    });

    // TEST 10: Duplicate voting prevention
    it("Should prevent a donor from voting twice in the same round", async function () {
        const {
            fundChain,
            creator,
            donor1,
            donor2
        } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);
        await submitEvidence(fundChain, creator);

        await fundChain.connect(donor1).voteOnMilestone(1, 0, true);

        await expect(
            fundChain.connect(donor1).voteOnMilestone(1, 0, false)
        ).to.be.revertedWith("Already voted");
    });

    // TEST 11: Approval with quorum
    it("Should approve a milestone when quorum is reached and yes votes exceed no votes", async function () {
        const {
            fundChain,
            creator,
            donor1,
            donor2
        } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);
        await submitEvidence(fundChain, creator);

        await fundChain.connect(donor1).voteOnMilestone(1, 0, true);

        await finishVoting(fundChain);

        await expect(
            fundChain.finalizeMilestone(1, 0)
        ).to.emit(fundChain, "MilestoneFinalized")
            .withArgs(1, 0, true, ETH("1"), 0);

        const milestone = await fundChain.getMilestone(1, 0);

        expect(milestone.status).to.equal(2n);
    });

    // TEST 12: Voting is not immediately finalizable
    it("Should prevent finalization before voting ends", async function () {
        const {
            fundChain,
            creator,
            donor1,
            donor2
        } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);
        await submitEvidence(fundChain, creator);

        await expect(
            fundChain.finalizeMilestone(1, 0)
        ).to.be.revertedWith("Voting still active");
    });

    // TEST 13: Rejection when quorum is not reached
    it("Should reject a milestone when voting quorum is not reached", async function () {
        const {
            fundChain,
            creator,
            donor1,
            donor2
        } = await deployFundChain();

        await createCampaign(
            fundChain,
            ETH("1"),
            [ETH("1")]
        );

        await fundChain.connect(donor1).donate(1, {
            value: ETH("0.1")
        });

        // Complete the goal with a second donation.
        // The first donor will cast the only vote.
        await fundChain.connect(donor2).donate(1, {
            value: ETH("0.9")
        });

        await submitEvidence(fundChain, creator);

        await fundChain.connect(donor1).voteOnMilestone(1, 0, true);

        await finishVoting(fundChain);

        await fundChain.finalizeMilestone(1, 0);

        const milestone = await fundChain.getMilestone(1, 0);

        expect(milestone.status).to.equal(3n);
    });

    // TEST 14: Equal votes should not pass
    it("Should reject a milestone when yes and no votes are equal", async function () {
        const {
            fundChain,
            creator,
            donor1,
            donor2
        } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);
        await submitEvidence(fundChain, creator);

        await fundChain.connect(donor1).voteOnMilestone(1, 0, true);
        await fundChain.connect(donor2).voteOnMilestone(1, 0, false);

        await finishVoting(fundChain);

        await fundChain.finalizeMilestone(1, 0);

        const milestone = await fundChain.getMilestone(1, 0);

        expect(milestone.status).to.equal(3n);
    });

    // TEST 15: Voting after deadline
    it("Should prevent voting after the voting deadline", async function () {
        const {
            fundChain,
            creator,
            donor1,
            donor2
        } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);
        await submitEvidence(fundChain, creator);

        await finishVoting(fundChain);

        await expect(
            fundChain.connect(donor1).voteOnMilestone(1, 0, true)
        ).to.be.revertedWith("Voting period ended");
    });

    // TEST 16: Release approved milestone funds
    it("Should release funds after milestone approval", async function () {
        const {
            fundChain,
            creator,
            donor1,
            donor2
        } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);
        await submitEvidence(fundChain, creator);

        await fundChain.connect(donor1).voteOnMilestone(1, 0, true);

        await finishVoting(fundChain);
        await fundChain.finalizeMilestone(1, 0);

        await expect(
            fundChain.releaseMilestoneFunds(1, 0)
        ).to.emit(fundChain, "MilestoneFundsReleased")
            .withArgs(1, 0, creator.address, ETH("1"));

        expect(await ethers.provider.getBalance(
            await fundChain.getAddress()
        )).to.equal(ETH("1"));

        const milestone = await fundChain.getMilestone(1, 0);

        expect(milestone.status).to.equal(4n);
    });

    // TEST 17: Prevent unapproved withdrawal
    it("Should prevent release of funds before milestone approval", async function () {
        const {
            fundChain,
            creator,
            donor1,
            donor2
        } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);

        await expect(
            fundChain.releaseMilestoneFunds(1, 0)
        ).to.be.revertedWith("Milestone not approved");
    });

    // TEST 18: Rejected milestone resubmission
    it("Should allow the creator to resubmit a rejected milestone", async function () {
        const {
            fundChain,
            creator,
            donor1,
            donor2
        } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);

        await submitEvidence(fundChain, creator);

        await fundChain.connect(donor1).voteOnMilestone(1, 0, false);

        await finishVoting(fundChain);
        await fundChain.finalizeMilestone(1, 0);

        await fundChain.connect(creator).submitMilestoneEvidence(
            1,
            0,
            "ipfs://evidence-2"
        );

        const milestone = await fundChain.getMilestone(1, 0);

        expect(milestone.status).to.equal(1n);
        expect(milestone.votingRound).to.equal(2n);
        expect(milestone.evidenceURI).to.equal("ipfs://evidence-2");

        // Donor can vote again in the new round.
        await fundChain.connect(donor1).voteOnMilestone(1, 0, true);

        expect(
            await fundChain.hasVoted(1, 0, 2, donor1.address)
        ).to.equal(true);
    });

    // TEST 19: Failed campaign refund
    it("Should allow donors to claim refunds after an unsuccessful campaign expires", async function () {
        const {
            fundChain,
            donor1
        } = await deployFundChain();

        const latestBlock = await ethers.provider.getBlock("latest");
        const deadline = BigInt(latestBlock!.timestamp + 3600);

        await fundChain.createCampaign(
            ETH("2"),
            deadline,
            "ipfs://failed-campaign",
            [ETH("1"), ETH("1")],
            ["First milestone", "Second milestone"],
            ["First description", "Second description"]
        );

        await fundChain.connect(donor1).donate(1, {
            value: ETH("1")
        });

        await networkHelpers.time.increaseTo(deadline);

        await expect(
            fundChain.connect(donor1).claimRefund(1)
        ).to.emit(fundChain, "RefundIssued")
            .withArgs(1, donor1.address, ETH("1"));

        expect(
            await fundChain.contributions(1, donor1.address)
        ).to.equal(0n);
    });

    // TEST 20: Refund before deadline
    it("Should prevent refunds before the campaign deadline", async function () {
        const {
            fundChain,
            donor1
        } = await deployFundChain();

        await createCampaign(fundChain);

        await fundChain.connect(donor1).donate(1, {
            value: ETH("1")
        });

        await expect(
            fundChain.connect(donor1).claimRefund(1)
        ).to.be.revertedWith("Campaign not ended");
    });

    // TEST 21: Donation after deadline
    it("Should prevent donations after the campaign deadline", async function () {
        const {
            fundChain,
            donor1
        } = await deployFundChain();

        const latestBlock = await ethers.provider.getBlock("latest");
        const deadline = BigInt(latestBlock!.timestamp + 3600);

        await fundChain.createCampaign(
            ETH("2"),
            deadline,
            "ipfs://campaign-1",
            [ETH("1"), ETH("1")],
            ["First", "Second"],
            ["First description", "Second description"]
        );

        await networkHelpers.time.increaseTo(deadline);

        await expect(
            fundChain.connect(donor1).donate(1, {
                value: ETH("0.5")
            })
        ).to.be.revertedWith("Campaign ended");
    });

    // TEST 22: Campaign progress
    it("Should return correct campaign progress", async function () {
        const {
            fundChain,
            donor1,
            donor2
        } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);

        const progress = await fundChain.getCampaignProgress(1);

        expect(progress.totalRaised).to.equal(ETH("2"));
        expect(progress.goal).to.equal(ETH("2"));
        expect(progress.paidMilestones).to.equal(0n);
        expect(progress.milestoneCount).to.equal(2n);
        expect(progress.completed).to.equal(false);
    });

    // TEST 23: Prevent next milestone before previous milestone is paid
    it("Should prevent submitting the next milestone before the previous milestone is paid", async function () {
        const { fundChain, creator, donor1, donor2 } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);

        // The second milestone cannot be submitted before the first is paid.
        await expect(
            fundChain.connect(creator).submitMilestoneEvidence(
                1, 1, "ipfs://evidence-2"
            )
        ).to.be.revertedWith("Previous milestone not paid");

        // The first milestone can be submitted.
        await expect(
            fundChain.connect(creator).submitMilestoneEvidence(
                1, 0, "ipfs://evidence-1"
            )
        ).to.emit(fundChain, "MilestoneEvidenceSubmitted");
    });

    // TEST 24: Campaign completion after all milestones are paid
    it("Should mark the campaign completed after all milestones are paid", async function () {
        const { fundChain, creator, donor1, donor2 } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);

        // Submit, vote on, approve, and pay the first milestone.
        await submitEvidence(fundChain, creator, 0);
        await fundChain.connect(donor1).voteOnMilestone(1, 0, true);
        await finishVoting(fundChain, 0);
        await fundChain.finalizeMilestone(1, 0);
        await fundChain.releaseMilestoneFunds(1, 0);

        // Submit, vote on, approve, and pay the second milestone.
        await submitEvidence(fundChain, creator, 1);
        await fundChain.connect(donor1).voteOnMilestone(1, 1, true);
        await finishVoting(fundChain, 1);
        await fundChain.finalizeMilestone(1, 1);

        await expect(
            fundChain.releaseMilestoneFunds(1, 1)
        ).to.emit(fundChain, "CampaignCompleted");

        const campaign = await fundChain.campaigns(1);
        const progress = await fundChain.getCampaignProgress(1);

        expect(campaign.completed).to.equal(true);
        expect(progress.completed).to.equal(true);
        expect(progress.paidMilestones).to.equal(2n);
    });

    // TEST 25: First rejection allows one resubmission
    it("Should allow exactly one resubmission after the first rejection", async function () {
        const { fundChain, creator, donor1, donor2 } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);
        await submitEvidence(fundChain, creator, 0);

        await fundChain.connect(donor1).voteOnMilestone(1, 0, false);
        await finishVoting(fundChain, 0);
        await fundChain.finalizeMilestone(1, 0);

        const rejected = await fundChain.getMilestone(1, 0);
        expect(rejected.rejectionCount).to.equal(1n);

        await expect(
            fundChain.connect(creator).submitMilestoneEvidence(
                1, 0, "ipfs://corrected-evidence"
            )
        ).to.emit(fundChain, "MilestoneEvidenceSubmitted");

        const resubmitted = await fundChain.getMilestone(1, 0);
        expect(resubmitted.votingRound).to.equal(2n);
        expect(resubmitted.status).to.equal(1n);
    });

    // TEST 26: Second rejection fails the campaign
    it("Should fail the campaign after the second rejection", async function () {
        const { fundChain, creator, donor1, donor2 } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);

        // First review and rejection.
        await submitEvidence(fundChain, creator, 0);
        await fundChain.connect(donor1).voteOnMilestone(1, 0, false);
        await finishVoting(fundChain, 0);
        await fundChain.finalizeMilestone(1, 0);

        // One permitted resubmission, followed by a second rejection.
        await submitEvidence(fundChain, creator, 0);
        await fundChain.connect(donor1).voteOnMilestone(1, 0, false);
        await finishVoting(fundChain, 0);

        await expect(
            fundChain.finalizeMilestone(1, 0)
        ).to.emit(fundChain, "CampaignFailed")
            .withArgs(1, ETH("2"));

        const campaign = await fundChain.campaigns(1);
        expect(campaign.failed).to.equal(true);
        expect(campaign.refundPool).to.equal(ETH("2"));
    });

    // TEST 27: Refund remaining funds proportionally after campaign failure
    it("Should refund donors their proportional share of remaining funds after a second rejection", async function () {
        const { fundChain, creator, donor1, donor2 } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);

        // Pay milestone 1, leaving 1 ETH in the campaign.
        await submitEvidence(fundChain, creator, 0);
        await fundChain.connect(donor1).voteOnMilestone(1, 0, true);
        await finishVoting(fundChain, 0);
        await fundChain.finalizeMilestone(1, 0);
        await fundChain.releaseMilestoneFunds(1, 0);

        // Reject milestone 2 twice.
        await submitEvidence(fundChain, creator, 1);
        await fundChain.connect(donor1).voteOnMilestone(1, 1, false);
        await finishVoting(fundChain, 1);
        await fundChain.finalizeMilestone(1, 1);

        await submitEvidence(fundChain, creator, 1);
        await fundChain.connect(donor1).voteOnMilestone(1, 1, false);
        await finishVoting(fundChain, 1);
        await fundChain.finalizeMilestone(1, 1);

        await expect(
            fundChain.connect(donor1).claimRefund(1)
        ).to.emit(fundChain, "RefundIssued")
            .withArgs(1, donor1.address, ETH("0.5"));

        await expect(
            fundChain.connect(donor2).claimRefund(1)
        ).to.emit(fundChain, "RefundIssued")
            .withArgs(1, donor2.address, ETH("0.5"));

        expect(await ethers.provider.getBalance(await fundChain.getAddress()))
            .to.equal(0n);
        expect((await fundChain.campaigns(1)).remainingFunds).to.equal(0n);
    });

    // TEST 28: Failed campaigns reject further actions
    it("Should block campaign actions after the second milestone rejection", async function () {
        const { fundChain, creator, donor1, donor2 } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);

        await submitEvidence(fundChain, creator, 0);
        await fundChain.connect(donor1).voteOnMilestone(1, 0, false);
        await finishVoting(fundChain, 0);
        await fundChain.finalizeMilestone(1, 0);

        await submitEvidence(fundChain, creator, 0);
        await fundChain.connect(donor1).voteOnMilestone(1, 0, false);
        await finishVoting(fundChain, 0);
        await fundChain.finalizeMilestone(1, 0);

        await expect(
            fundChain.connect(creator).submitMilestoneEvidence(1, 0, "ipfs://again")
        ).to.be.revertedWith("Campaign failed");

        await expect(
            fundChain.connect(donor1).donate(1, { value: ETH("0.1") })
        ).to.be.revertedWith("Campaign failed");

        await expect(
            fundChain.connect(donor2).voteOnMilestone(1, 0, true)
        ).to.be.revertedWith("Campaign failed");

        await expect(
            fundChain.releaseMilestoneFunds(1, 0)
        ).to.be.revertedWith("Campaign failed");
    });


    // TEST 29: Refund rounding must not block a zero-wei proportional claim
    it("Should allow a zero-wei rounded refund and distribute the full refund pool", async function () {
        const { fundChain, creator, donor1, donor2 } = await deployFundChain();

        // Goal is 3 wei: milestone 1 pays 1 wei, leaving 2 wei refundable.
        await createCampaign(fundChain, 3n, [1n, 2n]);
        await fundChain.connect(donor1).donate(1, { value: 1n });
        await fundChain.connect(donor2).donate(1, { value: 2n });

        // Approve and pay the first milestone (1 wei).
        await submitEvidence(fundChain, creator, 0);
        await fundChain.connect(donor2).voteOnMilestone(1, 0, true);
        await finishVoting(fundChain, 0);
        await fundChain.finalizeMilestone(1, 0);
        await fundChain.releaseMilestoneFunds(1, 0);

        // Reject the second milestone twice, which fails the campaign.
        await submitEvidence(fundChain, creator, 1);
        await fundChain.connect(donor1).voteOnMilestone(1, 1, false);
        await finishVoting(fundChain, 1);
        await fundChain.finalizeMilestone(1, 1);

        await submitEvidence(fundChain, creator, 1);
        await fundChain.connect(donor1).voteOnMilestone(1, 1, false);
        await finishVoting(fundChain, 1);
        await fundChain.finalizeMilestone(1, 1);

        expect((await fundChain.campaigns(1)).refundPool).to.equal(2n);

        // donor1's proportional share rounds down to zero wei.
        await expect(
            fundChain.connect(donor1).claimRefund(1)
        ).to.emit(fundChain, "RefundIssued");

        expect(
            await fundChain.refundClaimed(1, donor1.address)
        ).to.equal(true);

        expect(
            await fundChain.contributions(1, donor1.address)
        ).to.equal(0n);
        expect(await fundChain.refundClaimed(1, donor1.address)).to.equal(true);
        expect(await fundChain.contributions(1, donor1.address)).to.equal(0n);

        // The next claim receives the remaining 2 wei; no pool dust is trapped.
        await fundChain.connect(donor2).claimRefund(1);
        expect(
            (await fundChain.campaigns(1)).totalRefunded
        ).to.equal(2n);
        expect(await ethers.provider.getBalance(await fundChain.getAddress())).to.equal(0n);
    });


    // TEST 30: A non-donor cannot claim a campaign refund.
    it("Should prevent a non-donor from claiming a refund", async function () {
        const { fundChain, creator, donor1, donor2, outsider } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);

        // Reject the same milestone twice to fail the campaign.
        await submitEvidence(fundChain, creator, 0);
        await fundChain.connect(donor1).voteOnMilestone(1, 0, false);
        await finishVoting(fundChain, 0);
        await fundChain.finalizeMilestone(1, 0);

        await submitEvidence(fundChain, creator, 0);
        await fundChain.connect(donor1).voteOnMilestone(1, 0, false);
        await finishVoting(fundChain, 0);
        await fundChain.finalizeMilestone(1, 0);

        await expect(
            fundChain.connect(outsider).claimRefund(1)
        ).to.be.revertedWith("No contribution to refund");
    });

    // TEST 31: A donor cannot claim the same refund twice.
    it("Should prevent a donor from claiming a refund twice", async function () {
        const { fundChain, creator, donor1, donor2 } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);

        await submitEvidence(fundChain, creator, 0);
        await fundChain.connect(donor1).voteOnMilestone(1, 0, false);
        await finishVoting(fundChain, 0);
        await fundChain.finalizeMilestone(1, 0);

        await submitEvidence(fundChain, creator, 0);
        await fundChain.connect(donor1).voteOnMilestone(1, 0, false);
        await finishVoting(fundChain, 0);
        await fundChain.finalizeMilestone(1, 0);

        await fundChain.connect(donor1).claimRefund(1);

        await expect(
            fundChain.connect(donor1).claimRefund(1)
        ).to.be.revertedWith("Refund already claimed");
    });

    // TEST 32: Anyone may trigger release, but funds always go to the creator.
    it("Should send milestone funds to the creator even when an outsider triggers release", async function () {
        const { fundChain, creator, donor1, donor2, outsider } = await deployFundChain();

        await createCampaign(fundChain);
        await fundCampaign(fundChain, donor1, donor2);
        await submitEvidence(fundChain, creator, 0);
        await fundChain.connect(donor1).voteOnMilestone(1, 0, true);
        await finishVoting(fundChain, 0);
        await fundChain.finalizeMilestone(1, 0);

        const creatorBalanceBefore = await ethers.provider.getBalance(creator.address);

        await fundChain.connect(outsider).releaseMilestoneFunds(1, 0);

        const creatorBalanceAfter = await ethers.provider.getBalance(creator.address);
        expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(ETH("1"));
        expect(await ethers.provider.getBalance(await fundChain.getAddress())).to.equal(ETH("1"));
    });

    // TEST 33: A malicious creator contract cannot re-enter milestone release.
    it("Should block a reentrant milestone release from a malicious creator contract", async function () {
        const { fundChain, donor1, donor2, outsider } = await deployFundChain();

        const attacker = await ethers.deployContract(
            "ReentrantCreator",
            [await fundChain.getAddress()]
        );

        const latestBlock = await ethers.provider.getBlock("latest");
        const deadline = BigInt(latestBlock!.timestamp + 86400 * 7);

        await attacker.createCampaign(
            ETH("2"),
            deadline,
            "ipfs://reentrancy-test",
            [ETH("1"), ETH("1")],
            ["Milestone 1", "Milestone 2"],
            ["First", "Second"]
        );

        const campaignId = await attacker.campaignId();

        await fundChain.connect(donor1).donate(campaignId, { value: ETH("1") });
        await fundChain.connect(donor2).donate(campaignId, { value: ETH("1") });

        await attacker.submitEvidence(campaignId, 0, "ipfs://evidence-1");
        await fundChain.connect(donor1).voteOnMilestone(campaignId, 0, true);
        await finishVoting(fundChain, 0);
        await fundChain.finalizeMilestone(campaignId, 0);

        // The outsider triggers the legitimate release to the creator contract.
        await fundChain.connect(outsider).releaseMilestoneFunds(campaignId, 0);

        expect(await attacker.attemptedReentry()).to.equal(true);
        expect(await attacker.reentrySucceeded()).to.equal(false);
        expect(await ethers.provider.getBalance(await attacker.getAddress())).to.equal(ETH("1"));

        const milestone = await fundChain.getMilestone(campaignId, 0);
        expect(milestone.status).to.equal(4n);
        expect((await fundChain.campaigns(campaignId)).paidMilestones).to.equal(1n);
    });



    // TEST 34: Creator contributions count toward funding, but not voting quorum.
    it("Should exclude creator contributions from the milestone voting quorum", async function () {
        const { fundChain, creator, donor1 } = await deployFundChain();

        await createCampaign(fundChain);

        // The creator supplies 1.8 ETH and an eligible donor supplies 0.2 ETH.
        // The donor's 0.2 ETH is 100% of the eligible voting base, but only
        // 10% of totalRaised. It must satisfy the 20% eligible-donor quorum.
        await fundChain.connect(creator).donate(1, { value: ETH("1.8") });
        await fundChain.connect(donor1).donate(1, { value: ETH("0.2") });

        const fundedCampaign = await fundChain.campaigns(1);
        expect(fundedCampaign.totalRaised).to.equal(ETH("2"));
        expect(fundedCampaign.votingEligibleRaised).to.equal(ETH("0.2"));

        await submitEvidence(fundChain, creator, 0);
        await fundChain.connect(donor1).voteOnMilestone(1, 0, true);
        await finishVoting(fundChain, 0);

        await expect(fundChain.finalizeMilestone(1, 0))
            .to.emit(fundChain, "MilestoneFinalized")
            .withArgs(1, 0, true, ETH("0.2"), 0);

        const milestone = await fundChain.getMilestone(1, 0);
        expect(milestone.status).to.equal(2n);
    });

    // TEST 35: A creator-only funded campaign cannot pass with zero eligible votes.
    it("Should not approve a milestone when only the creator has contributed", async function () {
        const { fundChain, creator } = await deployFundChain();

        await createCampaign(fundChain);
        await fundChain.connect(creator).donate(1, { value: ETH("2") });

        const fundedCampaign = await fundChain.campaigns(1);
        expect(fundedCampaign.totalRaised).to.equal(ETH("2"));
        expect(fundedCampaign.votingEligibleRaised).to.equal(0n);

        await submitEvidence(fundChain, creator, 0);
        await finishVoting(fundChain, 0);
        await fundChain.finalizeMilestone(1, 0);

        const milestone = await fundChain.getMilestone(1, 0);
        expect(milestone.status).to.equal(3n);
        expect(milestone.yesVotes).to.equal(0n);
        expect(milestone.noVotes).to.equal(0n);
    });


    // TEST 36: Creator contributions remain eligible for proportional refunds.
    it("Should include creator contributions in refunds while excluding them from quorum", async function () {
        const { fundChain, creator, donor1 } = await deployFundChain();

        const latestBlock = await ethers.provider.getBlock("latest");
        const deadline = BigInt(latestBlock!.timestamp + 3600);

        await fundChain.createCampaign(
            ETH("2"),
            deadline,
            "ipfs://creator-refund-test",
            [ETH("1"), ETH("1")],
            ["First milestone", "Second milestone"],
            ["First description", "Second description"]
        );

        await fundChain.connect(creator).donate(1, { value: ETH("0.5") });
        await fundChain.connect(donor1).donate(1, { value: ETH("0.5") });

        const fundedCampaign = await fundChain.campaigns(1);
        expect(fundedCampaign.totalRaised).to.equal(ETH("1"));
        expect(fundedCampaign.votingEligibleRaised).to.equal(ETH("0.5"));

        await networkHelpers.time.increaseTo(deadline);

        await expect(fundChain.connect(creator).claimRefund(1))
            .to.emit(fundChain, "RefundIssued")
            .withArgs(1, creator.address, ETH("0.5"));

        await expect(fundChain.connect(donor1).claimRefund(1))
            .to.emit(fundChain, "RefundIssued")
            .withArgs(1, donor1.address, ETH("0.5"));

        expect((await fundChain.campaigns(1)).totalRefunded).to.equal(ETH("1"));
        expect(await ethers.provider.getBalance(await fundChain.getAddress())).to.equal(0n);
    });

});
