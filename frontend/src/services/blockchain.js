
import {
    BrowserProvider,
    Contract,
    parseEther,
    getAddress,
} from "ethers";

export const SEPOLIA_CHAIN_ID = 11155111n;

export const MILESTONE_STATUS = {
    0: "Pending",
    1: "In Review",
    2: "Approved",
    3: "Rejected",
    4: "Paid",
};

// V1 remains available for campaigns already published on the original contract.
// V2 is the default destination for every newly created campaign.
const RAW_V1_CONTRACT_ADDRESS = (
    import.meta.env.VITE_FUNDCHAIN_V1_CONTRACT_ADDRESS ||
    import.meta.env.VITE_FUNDCHAIN_CONTRACT_ADDRESS ||
    ""
).trim();

const RAW_V2_CONTRACT_ADDRESS = (
    import.meta.env.VITE_FUNDCHAIN_V2_CONTRACT_ADDRESS || ""
).trim();

const FUNDCHAIN_ABI = [
    "function createCampaign(uint256 _goal,uint256 _deadline,string _metadataURI,uint256[] _milestoneAmounts,string[] _milestoneTitles,string[] _milestoneDescriptions) returns (uint256)",
    "function donate(uint256 _campaignId) payable",

    "function submitMilestoneEvidence(uint256 _campaignId,uint256 _milestoneIndex,string _evidenceURI)",
    "function voteOnMilestone(uint256 _campaignId,uint256 _milestoneIndex,bool _approve)",
    "function finalizeMilestone(uint256 _campaignId,uint256 _milestoneIndex)",
    "function releaseMilestoneFunds(uint256 _campaignId,uint256 _milestoneIndex)",
    "function claimRefund(uint256 _campaignId)",

    "function getMilestone(uint256 _campaignId,uint256 _milestoneIndex) view returns (tuple(string title,string description,uint256 amount,string evidenceURI,uint256 votingDeadline,uint256 votingRound,uint256 yesVotes,uint256 noVotes,uint256 rejectionCount,uint8 status))",
    "function getMilestoneCount(uint256 _campaignId) view returns (uint256)",
    "function contributions(uint256,address) view returns (uint256)",
    "function hasVoted(uint256,uint256,uint256,address) view returns (bool)",

    "event CampaignCreated(uint256 indexed campaignId,address indexed creator,uint256 goal,uint256 deadline,uint256 milestoneCount)",
    "event DonationReceived(uint256 indexed campaignId,address indexed donor,uint256 amount)",
    "event MilestoneEvidenceSubmitted(uint256 indexed campaignId,uint256 indexed milestoneIndex,uint256 votingRound,string evidenceURI,uint256 votingDeadline)",
    "event MilestoneVoteCast(uint256 indexed campaignId,uint256 indexed milestoneIndex,address indexed voter,bool approved,uint256 votingPower)",
    "event MilestoneFinalized(uint256 indexed campaignId,uint256 indexed milestoneIndex,bool approved,uint256 yesVotes,uint256 noVotes)",
    "event MilestoneFundsReleased(uint256 indexed campaignId,uint256 indexed milestoneIndex,address indexed creator,uint256 amount)",
    "event CampaignCompleted(uint256 indexed campaignId)",
    "event CampaignFailed(uint256 indexed campaignId,uint256 refundableAmount)",
    "event RefundIssued(uint256 indexed campaignId,address indexed donor,uint256 amount)",
];

function normalizeContractAddress(rawAddress, label) {
    if (!rawAddress) {
        throw new Error(`${label} contract address is missing. Check frontend .env.`);
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(rawAddress)) {
        throw new Error(`Invalid ${label} contract address.`);
    }

    try {
        return getAddress(rawAddress.toLowerCase());
    } catch {
        throw new Error(`Unable to normalize ${label} contract address.`);
    }
}

function getConfiguredContractAddresses() {
    const addresses = [];

    if (RAW_V1_CONTRACT_ADDRESS) {
        addresses.push(normalizeContractAddress(RAW_V1_CONTRACT_ADDRESS, "FundChain V1"));
    }

    if (RAW_V2_CONTRACT_ADDRESS) {
        addresses.push(normalizeContractAddress(RAW_V2_CONTRACT_ADDRESS, "FundChain V2"));
    }

    return addresses;
}

function getFundChainAddress(requestedAddress, defaultVersion = "v1") {
    const v1Address = RAW_V1_CONTRACT_ADDRESS
        ? normalizeContractAddress(RAW_V1_CONTRACT_ADDRESS, "FundChain V1")
        : null;
    const v2Address = RAW_V2_CONTRACT_ADDRESS
        ? normalizeContractAddress(RAW_V2_CONTRACT_ADDRESS, "FundChain V2")
        : null;

    if (requestedAddress) {
        const requested = normalizeContractAddress(String(requestedAddress).trim(), "campaign");
        const allowed = getConfiguredContractAddresses();

        if (!allowed.some((address) => address === requested)) {
            throw new Error("This campaign uses an unrecognized FundChain contract address.");
        }

        return requested;
    }

    if (defaultVersion === "v2") {
        if (!v2Address) {
            throw new Error("FundChain V2 address is missing. Add VITE_FUNDCHAIN_V2_CONTRACT_ADDRESS to frontend .env.");
        }
        return v2Address;
    }

    if (!v1Address) {
        throw new Error("FundChain V1 address is missing. Add VITE_FUNDCHAIN_V1_CONTRACT_ADDRESS to frontend .env.");
    }

    return v1Address;
}

async function getSepoliaProvider() {
    if (!window.ethereum) {
        throw new Error("MetaMask is not installed.");
    }

    const provider = new BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();

    if (network.chainId !== SEPOLIA_CHAIN_ID) {
        throw new Error("Please switch MetaMask to Ethereum Sepolia.");
    }

    return provider;
}

export async function getFundChainSigner(requestedAddress, defaultVersion = "v1") {
    const contractAddress = getFundChainAddress(requestedAddress, defaultVersion);

    if (!window.ethereum) {
        throw new Error("MetaMask is not installed.");
    }

    const provider = new BrowserProvider(window.ethereum);

    await provider.send("eth_requestAccounts", []);

    let network = await provider.getNetwork();

    if (network.chainId !== SEPOLIA_CHAIN_ID) {
        try {
            await provider.send("wallet_switchEthereumChain", [
                { chainId: "0xaa36a7" },
            ]);
        } catch (error) {
            if (error.code === 4902) {
                await provider.send("wallet_addEthereumChain", [{
                    chainId: "0xaa36a7",
                    chainName: "Sepolia",
                    nativeCurrency: {
                        name: "Sepolia ETH",
                        symbol: "ETH",
                        decimals: 18,
                    },
                    rpcUrls: [
                        "https://ethereum-sepolia-rpc.publicnode.com",
                    ],
                    blockExplorerUrls: [
                        "https://sepolia.etherscan.io",
                    ],
                }]);
            } else {
                throw error;
            }
        }

        network = await provider.getNetwork();
    }

    if (network.chainId !== SEPOLIA_CHAIN_ID) {
        throw new Error("Please switch MetaMask to Ethereum Sepolia.");
    }

    const signer = await provider.getSigner();

    return {
        provider,
        signer,
        contractAddress,
    };
}

async function getReadContract(requestedAddress) {
    const provider = await getSepoliaProvider();

    return new Contract(
        getFundChainAddress(requestedAddress),
        FUNDCHAIN_ABI,
        provider
    );
}

async function getWriteContract(requestedAddress) {
    const { signer, contractAddress } = await getFundChainSigner(requestedAddress);

    return new Contract(
        contractAddress,
        FUNDCHAIN_ABI,
        signer
    );
}

async function waitForTransaction(tx) {
    const receipt = await tx.wait();

    if (!receipt || receipt.status !== 1) {
        throw new Error("Blockchain transaction failed.");
    }

    return {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
    };
}

// Create a campaign on FundChain
export async function publishCampaignOnChain({
    campaign,
    milestones,
    expectedWallet,
}) {
    // New campaigns are always created on V2.
    const { signer, contractAddress } = await getFundChainSigner(undefined, "v2");

    const signerAddress = getAddress(await signer.getAddress());

    if (
        expectedWallet &&
        signerAddress !== getAddress(expectedWallet)
    ) {
        throw new Error(
            "Connected MetaMask wallet differs from your verified campaign wallet."
        );
    }

    const contract = new Contract(contractAddress, FUNDCHAIN_ABI, signer);

    const deadlineMilliseconds = new Date(campaign.deadline).getTime();

    if (!Number.isFinite(deadlineMilliseconds)) {
        throw new Error("Invalid campaign deadline.");
    }

    const deadlineSeconds = BigInt(
        Math.floor(deadlineMilliseconds / 1000)
    );

    if (deadlineSeconds <= BigInt(Math.floor(Date.now() / 1000))) {
        throw new Error("Campaign deadline must be in the future.");
    }

    let goalWei;
    let amounts;

    try {
        goalWei = parseEther(campaign.targetEth);
        amounts = milestones.map((item) => parseEther(item.amountEth));
    } catch {
        throw new Error("Invalid ETH amount.");
    }

    if (goalWei <= 0n) {
        throw new Error("Campaign target must be greater than zero.");
    }

    const titles = milestones.map((item) => item.title.trim());
    const descriptions = milestones.map(
        (item) => item.description?.trim() || ""
    );

    const allocation = amounts.reduce((sum, value) => sum + value, 0n);

    if (allocation !== goalWei) {
        throw new Error(
            "Milestone allocations must exactly equal the campaign goal."
        );
    }

    const metadataURI = `fundchain://supabase-campaign/${campaign.id}`;

    const tx = await contract.createCampaign(
        goalWei,
        deadlineSeconds,
        metadataURI,
        amounts,
        titles,
        descriptions
    );

    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
        throw new Error("Blockchain transaction failed.");
    }
    const result = {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
    };

    const createdEvent = receipt.logs
        .map((log) => {
            try {
                return contract.interface.parseLog(log);
            } catch {
                return null;
            }
        })
        .find((event) => event?.name === "CampaignCreated");

    if (!createdEvent) {
        throw new Error("CampaignCreated event was not found.");
    }

    return {
        ...result,
        contractAddress,
        contractCampaignId: createdEvent.args.campaignId.toString(),
        creatorWallet: signerAddress,
    };
}

// Donate ETH to an existing FundChain campaign
export async function donateToCampaign({
    contractCampaignId,
    amountEth,
    expectedWallet,
    contractAddress: requestedContractAddress,
}) {
    if (
        contractCampaignId === undefined ||
        !/^\d+$/.test(String(contractCampaignId))
    ) {
        throw new Error("Invalid on-chain campaign ID.");
    }

    let amountWei;

    try {
        amountWei = parseEther(String(amountEth));
    } catch {
        throw new Error("Enter a valid ETH donation amount.");
    }

    if (amountWei <= 0n) {
        throw new Error("Donation must be greater than zero.");
    }

    const { signer, contractAddress } = await getFundChainSigner(requestedContractAddress);
    const signerAddress = getAddress(await signer.getAddress());

    if (
        expectedWallet &&
        signerAddress !== getAddress(expectedWallet)
    ) {
        throw new Error("Connected wallet does not match the verified wallet.");
    }

    const contract = new Contract(contractAddress, FUNDCHAIN_ABI, signer);

    await contract.donate.staticCall(
        BigInt(contractCampaignId),
        { value: amountWei }
    );

    const tx = await contract.donate(
        BigInt(contractCampaignId),
        { value: amountWei }
    );

    const receipt = await tx.wait();

    if (!receipt || receipt.status !== 1) {
        throw new Error("Donation transaction failed on Sepolia.");
    }

    const donationEvent = receipt.logs
        .map((log) => {
            try {
                return contract.interface.parseLog(log);
            } catch {
                return null;
            }
        })
        .find((event) => event?.name === "DonationReceived");

    if (!donationEvent) {
        throw new Error(
            "Donation succeeded, but DonationReceived event was not found."
        );
    }

    const eventCampaignId = donationEvent.args.campaignId.toString();
    const donor = getAddress(donationEvent.args.donor);
    const donatedAmount = donationEvent.args.amount;

    if (
        eventCampaignId !== String(contractCampaignId) ||
        donor !== signerAddress ||
        donatedAmount !== amountWei
    ) {
        throw new Error("Donation event did not match the submitted donation.");
    }

    return {
        transactionHash: tx.hash,
        contractCampaignId: eventCampaignId,
        donorWallet: donor,
        amountWei: donatedAmount.toString(),
        blockNumber: receipt.blockNumber,
        contractAddress,
    };
}

// Read one milestone directly from the deployed contract
export async function getMilestoneOnChain({
    contractCampaignId,
    milestoneIndex,
    contractAddress,
}) {
    const contract = await getReadContract(contractAddress);

    const milestone = await contract.getMilestone(
        BigInt(contractCampaignId),
        BigInt(milestoneIndex)
    );

    return {
        title: milestone.title,
        description: milestone.description,
        amountWei: milestone.amount.toString(),
        evidenceURI: milestone.evidenceURI,
        votingDeadline: Number(milestone.votingDeadline),
        votingRound: Number(milestone.votingRound),
        yesVotesWei: milestone.yesVotes.toString(),
        noVotesWei: milestone.noVotes.toString(),
        rejectionCount: Number(milestone.rejectionCount),
        statusCode: Number(milestone.status),
        status: MILESTONE_STATUS[Number(milestone.status)],
    };
}

// Read milestone count
export async function getMilestoneCountOnChain(contractCampaignId, contractAddress) {
    const contract = await getReadContract(contractAddress);

    const count = await contract.getMilestoneCount(
        BigInt(contractCampaignId)
    );

    return Number(count);
}

// Read a donor's voting eligibility and voting history
export async function getMilestoneVotingInfo({
    contractCampaignId,
    milestoneIndex,
    votingRound,
    walletAddress,
    contractAddress,
}) {
    const contract = await getReadContract(contractAddress);
    const wallet = getAddress(walletAddress);

    const [contribution, alreadyVoted] = await Promise.all([
        contract.contributions(
            BigInt(contractCampaignId),
            wallet
        ),
        contract.hasVoted(
            BigInt(contractCampaignId),
            BigInt(milestoneIndex),
            BigInt(votingRound),
            wallet
        ),
    ]);

    return {
        contributionWei: contribution.toString(),
        isEligible: contribution > 0n,
        alreadyVoted,
    };
}

// Creator submits milestone evidence
export async function submitMilestoneEvidenceOnChain({
    contractCampaignId,
    milestoneIndex,
    evidenceURI,
    expectedWallet,
    contractAddress,
}) {
    if (!evidenceURI?.trim()) {
        throw new Error("Milestone evidence is required.");
    }

    const contract = await getWriteContract(contractAddress);
    const signerAddress = getAddress(await contract.runner.getAddress());

    if (
        expectedWallet &&
        signerAddress !== getAddress(expectedWallet)
    ) {
        throw new Error("Connected wallet is not the campaign creator wallet.");
    }

    const tx = await contract.submitMilestoneEvidence(
        BigInt(contractCampaignId),
        BigInt(milestoneIndex),
        evidenceURI.trim()
    );

    return waitForTransaction(tx);
}

// Eligible donor votes on a milestone
export async function voteOnMilestoneOnChain({
    contractCampaignId,
    milestoneIndex,
    approve,
    contractAddress,
}) {
    if (typeof approve !== "boolean") {
        throw new Error("Choose approve or reject.");
    }

    const contract = await getWriteContract(contractAddress);

    const tx = await contract.voteOnMilestone(
        BigInt(contractCampaignId),
        BigInt(milestoneIndex),
        approve
    );

    return waitForTransaction(tx);
}

// Finalize a milestone after its voting deadline
export async function finalizeMilestoneOnChain({
    contractCampaignId,
    milestoneIndex,
    contractAddress,
}) {
    const contract = await getWriteContract(contractAddress);

    const tx = await contract.finalizeMilestone(
        BigInt(contractCampaignId),
        BigInt(milestoneIndex)
    );

    return waitForTransaction(tx);
}

// Creator releases funds after milestone approval
export async function releaseMilestoneFundsOnChain({
    contractCampaignId,
    milestoneIndex,
    expectedWallet,
    contractAddress,
}) {
    const contract = await getWriteContract(contractAddress);
    const signerAddress = getAddress(await contract.runner.getAddress());

    if (
        expectedWallet &&
        signerAddress !== getAddress(expectedWallet)
    ) {
        throw new Error("Connected wallet is not the campaign creator wallet.");
    }

    const tx = await contract.releaseMilestoneFunds(
        BigInt(contractCampaignId),
        BigInt(milestoneIndex)
    );

    return waitForTransaction(tx);
}

// Donor claims a refund when the contract permits it
export async function claimCampaignRefundOnChain({
    contractCampaignId,
    contractAddress,
}) {
    const contract = await getWriteContract(contractAddress);

    const tx = await contract.claimRefund(
        BigInt(contractCampaignId)
    );

    return waitForTransaction(tx);
}
