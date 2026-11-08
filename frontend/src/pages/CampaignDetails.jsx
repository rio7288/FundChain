import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft, ArrowUpRight, CalendarDays, CheckCircle2, Clock3,
    ExternalLink, FileText, Heart, LoaderCircle, LockKeyhole,
    RefreshCw, Target, UploadCloud, Wallet, UserRound, AtSign
} from "lucide-react";
import { formatEther } from "ethers";
import { supabase } from "../services/supabase";
import {
    donateToCampaign,
    getMilestoneOnChain,
    getMilestoneVotingInfo,
    voteOnMilestoneOnChain,
    finalizeMilestoneOnChain,
    releaseMilestoneFundsOnChain,
    claimCampaignRefundOnChain,
    submitMilestoneEvidenceOnChain,
} from "../services/blockchain";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import "../styles/campaign-details.css";
import { API_URL } from "../api";
const EVIDENCE_BUCKET = "milestone-evidence";
const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EVIDENCE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
];

function formatETH(value) {
    try {
        if (value === null || value === undefined || value === "") return "0 ETH";
        return `${Number(formatEther(BigInt(value))).toLocaleString("en-IN", {
            maximumFractionDigits: 4,
        })} ETH`;
    } catch {
        return "0 ETH";
    }
}

function formatDate(value) {
    if (!value) return "Not specified";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not specified";
    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function formatCountdown(timestamp) {
    const seconds = Math.max(0, Number(timestamp) - Math.floor(Date.now() / 1000));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return days > 0
        ? `${days}d ${hours}h remaining`
        : hours > 0
            ? `${hours}h ${minutes}m remaining`
            : `${minutes}m remaining`;
}

function shortAddress(address) {
    return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Unknown";
}

function chainStatusLabel(status) {
    return status || "Pending";
}

export default function CampaignDetails() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [campaign, setCampaign] = useState(null);
    const [creatorProfile, setCreatorProfile] = useState(null);
    const [milestones, setMilestones] = useState([]);
    const [chainMilestones, setChainMilestones] = useState([]);
    const [donations, setDonations] = useState([]);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pageError, setPageError] = useState("");

    const [donationAmount, setDonationAmount] = useState("");
    const [donating, setDonating] = useState(false);
    const [donationMessage, setDonationMessage] = useState("");
    const [donationError, setDonationError] = useState("");

    const [selectedFiles, setSelectedFiles] = useState({});
    const [evidenceDescriptions, setEvidenceDescriptions] = useState({});
    const [submittingMilestone, setSubmittingMilestone] = useState(null);
    const [evidenceMessage, setEvidenceMessage] = useState("");
    const [evidenceError, setEvidenceError] = useState("");

    // Donor voting state, keyed by milestone index.
    const [votingInfo, setVotingInfo] = useState({});
    const [votingAction, setVotingAction] = useState(null);
    const [votingMessage, setVotingMessage] = useState("");
    const [votingError, setVotingError] = useState("");

    const isCreator = Boolean(user && campaign && campaign.creator_id === user.id);

    const loadDonations = useCallback(async () => {
        const { data, error } = await supabase
            .from("donations")
            .select("id, wallet_address, amount_wei, tx_hash, created_at, is_anonymous")
            .eq("campaign_id", id)
            .order("created_at", { ascending: false });

        if (error) throw error;
        setDonations(data || []);
    }, [id]);

    const loadChainMilestones = useCallback(async (campaignRow, databaseMilestones) => {
        if (!campaignRow?.contract_campaign_id) {
            setChainMilestones([]);
            return;
        }

        const results = await Promise.all(
            databaseMilestones.map(async (_, index) => {
                try {
                    return await getMilestoneOnChain({
                        contractCampaignId: campaignRow.contract_campaign_id,
                        contractAddress: campaignRow.contract_address,
                        milestoneIndex: index,
                    });
                } catch (error) {
                    console.warn(`Unable to load on-chain milestone ${index}:`, error);
                    return null;
                }
            })
        );

        setChainMilestones(results);
    }, []);

    const loadCampaign = useCallback(async (showRefresh = false) => {
        if (showRefresh) setRefreshing(true);
        else setLoading(true);
        setPageError("");

        try {
            const [{ data: authData }, { data: campaignRow, error: campaignError }] =
                await Promise.all([
                    supabase.auth.getUser(),
                    supabase.from("campaigns").select("*").eq("id", id).maybeSingle(),
                ]);

            if (campaignError) throw campaignError;
            if (!campaignRow) throw new Error("Campaign not found.");

            const { data: milestoneRows, error: milestoneError } = await supabase
                .from("milestones")
                .select("*")
                .eq("campaign_id", id)
                .order("sequence_number", { ascending: true });

            if (milestoneError) throw milestoneError;

            // Load the public creator profile using the campaign's creator_id.
            // Email addresses are intentionally not selected or displayed.
            const { data: profileRow, error: profileError } = await supabase
                .from("profiles")
                .select("full_name, username, role")
                .eq("id", campaignRow.creator_id)
                .maybeSingle();

            if (profileError) {
                console.warn("Creator profile could not be loaded:", profileError.message);
            }

            setUser(authData?.user || null);
            setCampaign(campaignRow);
            setCreatorProfile(profileRow || null);
            setMilestones(milestoneRows || []);

            await Promise.all([
                loadDonations(),
                loadChainMilestones(campaignRow, milestoneRows || []),
            ]);
        } catch (error) {
            console.error("Campaign loading error:", error);
            setPageError(error?.message || "Unable to load this campaign.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [id, loadDonations, loadChainMilestones]);

    useEffect(() => {
        loadCampaign();
    }, [loadCampaign]);

    // Keep verified donations synchronized between browser windows.
    useEffect(() => {
        const channel = supabase
            .channel(`campaign-donations-${id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "donations",
                    filter: `campaign_id=eq.${id}`,
                },
                (payload) => {
                    const row = payload.new;
                    setDonations((current) =>
                        current.some((item) => item.id === row.id)
                            ? current
                            : [row, ...current]
                    );
                }
            )
            .subscribe((status) => {
                console.log(`Donation realtime (${id}):`, status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id]);

    // Refresh voting countdown labels while a milestone is under review.
    const [, setClockTick] = useState(0);
    useEffect(() => {
        const timer = window.setInterval(() => setClockTick((tick) => tick + 1), 30000);
        return () => window.clearInterval(timer);
    }, []);

    const raisedWei = useMemo(
        () => donations.reduce((sum, item) => sum + BigInt(item.amount_wei || "0"), 0n),
        [donations]
    );
    const raisedAmount = Number(formatEther(raisedWei));
    const targetAmount = campaign?.target_amount_wei
        ? Number(formatEther(BigInt(campaign.target_amount_wei)))
        : 0;
    const fundingProgress = targetAmount > 0
        ? Math.min((raisedAmount / targetAmount) * 100, 100)
        : 0;
    const paidCount = chainMilestones.filter((item) => item?.status === "Paid").length;
    const milestoneProgress = milestones.length
        ? (paidCount / milestones.length) * 100
        : 0;

    // Read voting eligibility for the currently connected MetaMask wallet.
    const loadVotingInfo = useCallback(async () => {
        if (!window.ethereum || !campaign?.contract_campaign_id) {
            setVotingInfo({});
            return;
        }

        try {
            const accounts = await window.ethereum.request({
                method: "eth_accounts",
            });
            const walletAddress = accounts?.[0];

            if (!walletAddress) {
                setVotingInfo({});
                return;
            }

            const reviewMilestones = chainMilestones
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => item?.status === "In Review");

            const entries = await Promise.all(
                reviewMilestones.map(async ({ item, index }) => {
                    const info = await getMilestoneVotingInfo({
                        contractCampaignId: campaign.contract_campaign_id,
                        contractAddress: campaign.contract_address,
                        milestoneIndex: index,
                        votingRound: item.votingRound,
                        walletAddress,
                    });
                    return [index, { ...info, walletAddress }];
                })
            );

            setVotingInfo(Object.fromEntries(entries));
        } catch (error) {
            console.warn("Unable to load donor voting information:", error);
            setVotingInfo({});
        }
    }, [campaign?.contract_campaign_id, chainMilestones]);

    useEffect(() => {
        loadVotingInfo();
    }, [loadVotingInfo]);

    // A donor can vote once per voting round. The contract remains authoritative.
    const handleMilestoneVote = async (milestoneIndex, approve) => {
        if (!user) {
            navigate("/login", { state: { from: `/campaign/${id}` } });
            return;
        }

        if (isCreator) {
            setVotingError("Campaign creators cannot vote on their own milestones.");
            return;
        }

        const info = votingInfo[milestoneIndex];
        if (!info?.walletAddress || !info.isEligible || info.alreadyVoted) {
            setVotingError("This wallet is not eligible to vote, or has already voted.");
            return;
        }

        setVotingAction(`${milestoneIndex}-vote`);
        setVotingError("");
        setVotingMessage("Confirm your vote in MetaMask...");

        try {
            const result = await voteOnMilestoneOnChain({
                contractCampaignId: campaign.contract_campaign_id,
                contractAddress: campaign.contract_address,
                milestoneIndex,
                approve,
            });

            const freshMilestone = await getMilestoneOnChain({
                contractCampaignId: campaign.contract_campaign_id,
                contractAddress: campaign.contract_address,
                milestoneIndex,
            });

            setChainMilestones((current) => {
                const next = [...current];
                next[milestoneIndex] = freshMilestone;
                return next;
            });

            setVotingInfo((current) => ({
                ...current,
                [milestoneIndex]: {
                    ...current[milestoneIndex],
                    alreadyVoted: true,
                },
            }));

            setVotingMessage(
                `Your ${approve ? "YES" : "NO"} vote was recorded. Transaction: ${shortAddress(result.transactionHash)}`
            );
            await loadVotingInfo();
        } catch (error) {
            console.error("Milestone vote error:", error);
            setVotingMessage("");
            setVotingError(
                error?.shortMessage || error?.reason || error?.message || "Vote failed."
            );
        } finally {
            setVotingAction(null);
        }
    };

    // Anyone may finalize after the on-chain voting deadline.
    const handleFinalizeMilestone = async (milestoneIndex) => {
        const chain = chainMilestones[milestoneIndex];
        if (!chain || chain.status !== "In Review") return;

        if (Number(chain.votingDeadline) > Math.floor(Date.now() / 1000)) {
            setVotingError("Voting is still open. Finalization is available after the deadline.");
            return;
        }

        setVotingAction(`${milestoneIndex}-finalize`);
        setVotingError("");
        setVotingMessage("Confirm milestone finalization in MetaMask...");

        try {
            const result = await finalizeMilestoneOnChain({
                contractCampaignId: campaign.contract_campaign_id,
                contractAddress: campaign.contract_address,
                milestoneIndex,
            });

            const freshMilestone = await getMilestoneOnChain({
                contractCampaignId: campaign.contract_campaign_id,
                contractAddress: campaign.contract_address,
                milestoneIndex,
            });

            setChainMilestones((current) => {
                const next = [...current];
                next[milestoneIndex] = freshMilestone;
                return next;
            });

            setVotingMessage(
                `Voting finalized: ${freshMilestone.status}. Transaction: ${shortAddress(result.transactionHash)}`
            );
            await loadVotingInfo();
        } catch (error) {
            console.error("Milestone finalization error:", error);
            setVotingMessage("");
            setVotingError(
                error?.shortMessage || error?.reason || error?.message || "Finalization failed."
            );
        } finally {
            setVotingAction(null);
        }
    };

    const handleReleaseMilestone = async (milestoneIndex) => {
        if (!isCreator) {
            setVotingError("Only the campaign creator can release approved milestone funds.");
            return;
        }
        setVotingAction(`${milestoneIndex}-release`);
        setVotingError("");
        setVotingMessage("Confirm milestone fund release in MetaMask...");
        try {
            const result = await releaseMilestoneFundsOnChain({
                contractCampaignId: campaign.contract_campaign_id,
                contractAddress: campaign.contract_address,
                milestoneIndex,
                expectedWallet: campaign.creator_wallet || undefined,
            });
            const freshMilestone = await getMilestoneOnChain({
                contractCampaignId: campaign.contract_campaign_id,
                contractAddress: campaign.contract_address,
                milestoneIndex,
            });
            setChainMilestones((current) => {
                const next = [...current];
                next[milestoneIndex] = freshMilestone;
                return next;
            });
            setVotingMessage(`Milestone funds released. Transaction: ${shortAddress(result.transactionHash)}`);
        } catch (error) {
            setVotingMessage("");
            setVotingError(error?.shortMessage || error?.reason || error?.message || "Fund release failed.");
        } finally {
            setVotingAction(null);
        }
    };

    const handleClaimRefund = async () => {
        if (!user) {
            navigate("/login", { state: { from: `/campaign/${id}` } });
            return;
        }
        setVotingAction("refund");
        setVotingError("");
        setVotingMessage("Confirm your refund claim in MetaMask...");
        try {
            const result = await claimCampaignRefundOnChain({
                contractCampaignId: campaign.contract_campaign_id,
                contractAddress: campaign.contract_address,
            });
            setVotingMessage(`Refund transaction confirmed: ${shortAddress(result.transactionHash)}`);
            await loadCampaign(true);
        } catch (error) {
            setVotingMessage("");
            setVotingError(error?.shortMessage || error?.reason || error?.message || "Refund claim failed. The contract will determine eligibility.");
        } finally {
            setVotingAction(null);
        }
    };

    const handleDonate = async () => {
        if (!user) {
            navigate("/login", { state: { from: `/campaign/${id}` } });
            return;
        }
        if (!window.ethereum) {
            setDonationError("MetaMask is not installed.");
            return;
        }
        if (!donationAmount || !Number.isFinite(Number(donationAmount)) || Number(donationAmount) <= 0) {
            setDonationError("Enter a valid ETH amount.");
            return;
        }
        if (campaign?.status !== "active") {
            setDonationError("This campaign is not accepting donations.");
            return;
        }
        if (campaign?.contract_campaign_id === null || campaign?.contract_campaign_id === undefined) {
            setDonationError("This campaign has no verified on-chain campaign ID.");
            return;
        }

        setDonating(true);
        setDonationError("");
        setDonationMessage("Waiting for MetaMask confirmation...");

        try {
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            const accessToken = sessionData?.session?.access_token;
            if (!accessToken) throw new Error("Your session has expired. Please log in again.");

            const result = await donateToCampaign({
                contractCampaignId: campaign.contract_campaign_id,
                contractAddress: campaign.contract_address,
                amountEth: donationAmount,
            });

            setDonationMessage("Transaction confirmed. Verifying with FundChain...");

            const response = await fetch(`${API_URL}/campaigns/${id}/donations`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    transactionHash: result.transactionHash,
                    walletAddress: result.donorWallet,
                }),
            });

            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.message || "Backend donation verification failed.");
            }

            setDonationMessage("Donation verified and recorded successfully!");
            setDonationAmount("");
            await loadCampaign(true);
        } catch (error) {
            console.error("Donation error:", error);
            setDonationError(
                error?.shortMessage || error?.reason || error?.message || "Donation failed."
            );
            setDonationMessage("");
        } finally {
            setDonating(false);
        }
    };

    const handleEvidenceSubmit = async (milestone, index) => {
        if (!user) {
            navigate("/login", { state: { from: `/campaign/${id}` } });
            return;
        }
        if (!isCreator) {
            setEvidenceError("Only the campaign creator can submit evidence.");
            return;
        }
        if (fundingProgress < 100) {
            setEvidenceError("Evidence submission unlocks once the campaign reaches its funding goal.");
            return;
        }
        if (!window.ethereum) {
            setEvidenceError("MetaMask is not installed.");
            return;
        }
        if (campaign?.contract_campaign_id === null || campaign?.contract_campaign_id === undefined) {
            setEvidenceError("This campaign has no verified on-chain campaign ID.");
            return;
        }

        const file = selectedFiles[milestone.id];
        const description = (evidenceDescriptions[milestone.id] || "").trim();

        if (!file) {
            setEvidenceError("Choose an evidence file first.");
            return;
        }
        if (!ALLOWED_EVIDENCE_TYPES.includes(file.type)) {
            setEvidenceError("Allowed files: JPG, PNG, WEBP or PDF.");
            return;
        }
        if (file.size > MAX_EVIDENCE_SIZE) {
            setEvidenceError("The file must be 10 MB or smaller.");
            return;
        }
        if (!description) {
            setEvidenceError("Add a short description of the evidence.");
            return;
        }

        const chainMilestone = chainMilestones[index];
        const status = chainMilestone?.status || "Pending";
        if (!["Pending", "Rejected"].includes(status)) {
            setEvidenceError(`Evidence cannot be submitted while this milestone is ${status}.`);
            return;
        }
        if (chainMilestone?.rejectionCount >= 2) {
            setEvidenceError("This milestone has reached its resubmission limit.");
            return;
        }

        setSubmittingMilestone(milestone.id);
        setEvidenceError("");
        setEvidenceMessage("Uploading evidence to Supabase...");

        let uploadedPath = null;
        let transactionConfirmed = false;

        try {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            uploadedPath = `${user.id}/${id}/${index}/${Date.now()}-${safeName}`;

            const { error: uploadError } = await supabase.storage
                .from(EVIDENCE_BUCKET)
                .upload(uploadedPath, file, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: file.type,
                });
            if (uploadError) throw uploadError;

            const { data: publicData } = supabase.storage
                .from(EVIDENCE_BUCKET)
                .getPublicUrl(uploadedPath);
            const evidenceUrl = publicData?.publicUrl;
            if (!evidenceUrl) throw new Error("Could not create a public evidence URL.");

            setEvidenceMessage("Confirm the evidence submission in MetaMask...");

            const result = await submitMilestoneEvidenceOnChain({
                contractCampaignId: campaign.contract_campaign_id,
                contractAddress: campaign.contract_address,
                milestoneIndex: index,
                evidenceURI: evidenceUrl,
                expectedWallet: campaign.creator_wallet || undefined,
            });
            transactionConfirmed = true;

            const freshMilestone = await getMilestoneOnChain({
                contractCampaignId: campaign.contract_campaign_id,
                contractAddress: campaign.contract_address,
                milestoneIndex: index,
            });

            setChainMilestones((current) => {
                const next = [...current];
                next[index] = freshMilestone;
                return next;
            });

            setEvidenceMessage(
                `Evidence submitted on Sepolia. Transaction: ${shortAddress(result.transactionHash)}`
            );
            setSelectedFiles((current) => ({ ...current, [milestone.id]: null }));
            setEvidenceDescriptions((current) => ({ ...current, [milestone.id]: "" }));
        } catch (error) {
            console.error("Evidence submission error:", error);

            // Only remove the uploaded file when the chain transaction did not confirm.
            // If it confirmed, keep the file because its URL is permanently stored on-chain.
            if (uploadedPath && !transactionConfirmed) {
                const { error: cleanupError } = await supabase.storage
                    .from(EVIDENCE_BUCKET)
                    .remove([uploadedPath]);
                if (cleanupError) console.error("Evidence cleanup error:", cleanupError);
            }

            setEvidenceMessage("");
            setEvidenceError(
                error?.shortMessage || error?.reason || error?.message || "Evidence submission failed."
            );
        } finally {
            setSubmittingMilestone(null);
        }
    };

    if (loading) {
        return (
            <div className="campaign-details-page">
                <Navbar />
                <div className="campaign-details-loading">
                    <LoaderCircle className="loading-icon" size={30} />
                    <p>Loading campaign...</p>
                </div>
                <Footer />
            </div>
        );
    }

    if (pageError || !campaign) {
        return (
            <div className="campaign-details-page">
                <Navbar />
                <main className="campaign-details-container">
                    <div className="campaign-details-error">
                        <h2>Unable to load campaign</h2>
                        <p>{pageError || "Campaign not found."}</p>
                        <Link to="/explore-projects" className="cd-primary-button">
                            <ArrowLeft size={16} /> Explore projects
                        </Link>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="campaign-details-page">
            <Navbar />
            <main className="campaign-details-container">
                <Link to="/explore-projects" className="cd-back-link">
                    <ArrowLeft size={16} /> Back to projects
                </Link>

                <section className="cd-hero">
                    <div className="cd-image">
                        {campaign.image_url ? (
                            <img src={campaign.image_url} alt={campaign.title} />
                        ) : (
                            <div className="cd-image-placeholder">FUNDCHAIN</div>
                        )}
                        <span className="cd-category">{campaign.category || "Community project"}</span>
                    </div>
                    <div className="cd-hero-content">
                        <p className="cd-eyebrow">A PROJECT WORTH SUPPORTING</p>
                        <h1>{campaign.title}</h1>
                        <p className="cd-description">{campaign.description}</p>
                        <div className="cd-quick-info">
                            <div><CalendarDays size={17} /><span>Deadline: {formatDate(campaign.deadline)}</span></div>
                            <div><Target size={17} /><span>Goal: {formatETH(campaign.target_amount_wei)}</span></div>
                        </div>
                        <button
                            className="cd-primary-button"
                            type="button"
                            onClick={() => document.getElementById("cd-donation-input")?.focus()}
                        >
                            <Heart size={17} /> Support this project <ArrowUpRight size={17} />
                        </button>
                        <p className="cd-secure-note"><LockKeyhole size={13} /> Blockchain-backed crowdfunding</p>
                    </div>
                </section>

                <section className="cd-section cd-funding-section">
                    <div className="cd-section-heading">
                        <div>
                            <p className="cd-section-eyebrow">COMMUNITY SUPPORT</p>
                            <h2>Campaign funding</h2>
                        </div>
                        <button
                            className="cd-refresh-button"
                            type="button"
                            onClick={() => loadCampaign(true)}
                            disabled={refreshing}
                        >
                            <RefreshCw size={15} /> {refreshing ? "Refreshing..." : "Refresh"}
                        </button>
                    </div>
                    <div className="cd-funding-numbers">
                        <div><strong>{formatETH(raisedWei.toString())}</strong><span>Raised so far</span></div>
                        <div><strong>{formatETH(campaign.target_amount_wei)}</strong><span>Funding goal</span></div>
                        <div><strong>{fundingProgress.toFixed(1)}%</strong><span>Goal reached</span></div>
                    </div>
                    <div className="cd-progress-track">
                        <div className="cd-progress-fill" style={{ width: `${fundingProgress}%` }} />
                    </div>
                    <p className="cd-funding-caption">{donations.length} verified contribution(s) recorded</p>
                </section>

                <section className="cd-content-grid">
                    <div className="cd-main-column">
                        <div className="cd-section">
                            <p className="cd-section-eyebrow">THE STORY</p>
                            <h2>About this project</h2>
                            <p className="cd-about">{campaign.description || "No additional project information is available."}</p>
                        </div>

                        <section className="cd-section cd-creator-section" aria-labelledby="cd-creator-heading">
                            <p className="cd-section-eyebrow">THE PERSON BEHIND THE IDEA</p>
                            <h2 id="cd-creator-heading">About the creator</h2>

                            <div className="cd-creator-card">
                                <div className="cd-creator-avatar" aria-hidden="true">
                                    <UserRound size={27} />
                                </div>

                                <div className="cd-creator-details">
                                    <div className="cd-creator-name-row">
                                        <h3>
                                            {creatorProfile?.full_name ||
                                                creatorProfile?.username ||
                                                "FundChain member"}
                                        </h3>
                                        <span className="cd-creator-badge">
                                            <CheckCircle2 size={13} />
                                            Campaign creator
                                        </span>
                                    </div>

                                    {creatorProfile?.username && (
                                        <p className="cd-creator-username">
                                            <AtSign size={14} />
                                            {creatorProfile.username}
                                        </p>
                                    )}

                                    <div className="cd-creator-meta">
                                        <span>
                                            <UserRound size={14} />
                                            {creatorProfile?.role || "Member"}
                                        </span>
                                        {campaign.creator_wallet && (
                                            <span title={campaign.creator_wallet}>
                                                <Wallet size={14} />
                                                {shortAddress(campaign.creator_wallet)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <p className="cd-creator-note">
                                This profile is associated with the account that created this campaign.
                            </p>
                        </section>

                        <div className="cd-section cd-milestones-section">
                            <div className="cd-section-heading">
                                <div>
                                    <p className="cd-section-eyebrow">TRANSPARENT FUNDING</p>
                                    <h2>Project milestones</h2>
                                </div>
                                <span className="cd-milestone-count">{paidCount}/{milestones.length} paid</span>
                            </div>

                            {milestones.length > 0 && (
                                <div className="cd-progress-track">
                                    <div className="cd-progress-fill" style={{ width: `${milestoneProgress}%` }} />
                                </div>
                            )}

                            {milestones.length === 0 ? (
                                <div className="cd-no-milestones">
                                    <Clock3 size={22} /><p>No milestone information is available.</p>
                                </div>
                            ) : (
                                <div className="cd-timeline">
                                    {milestones.map((milestone, index) => {
                                        const chain = chainMilestones[index];
                                        const status = chainStatusLabel(chain?.status);
                                        const paid = status === "Paid";
                                        const inReview = status === "In Review";
                                        const file = selectedFiles[milestone.id];

                                        return (
                                            <div className="cd-timeline-item" key={milestone.id}>
                                                <div className="cd-timeline-marker">
                                                    {paid ? <CheckCircle2 size={20} /> : <span>{index + 1}</span>}
                                                </div>
                                                <article className="cd-milestone-card">
                                                    <div className="cd-milestone-top">
                                                        <span>MILESTONE {index + 1}</span>
                                                        <span className={`cd-status ${paid ? "completed" : ""}`}>
                                                            {chain ? status : "Loading chain status"}
                                                        </span>
                                                    </div>
                                                    <h3>{milestone.title}</h3>
                                                    <p>{milestone.description || "No description provided."}</p>
                                                    <div className="cd-milestone-amount">
                                                        <Wallet size={15} /> {formatETH(milestone.amount_wei)}
                                                    </div>

                                                    {chain?.evidenceURI && (
                                                        <div className="cd-evidence-preview">
                                                            <FileText size={17} />
                                                            <a href={chain.evidenceURI} target="_blank" rel="noreferrer">
                                                                View submitted evidence <ExternalLink size={13} />
                                                            </a>
                                                        </div>
                                                    )}

                                                    {inReview && (
                                                        <div className="cd-voting-panel">
                                                            <div className="cd-voting-heading">
                                                                <div>
                                                                    <h4>Community milestone vote</h4>
                                                                    <p>Eligible donors can vote once during this voting round.</p>
                                                                </div>
                                                                <span className="cd-status">In Review</span>
                                                            </div>

                                                            <div className="cd-vote-totals">
                                                                <div className="cd-vote-total cd-vote-yes">
                                                                    <span>YES votes</span>
                                                                    <strong>{formatETH(chain.yesVotesWei || "0")}</strong>
                                                                </div>
                                                                <div className="cd-vote-total cd-vote-no">
                                                                    <span>NO votes</span>
                                                                    <strong>{formatETH(chain.noVotesWei || "0")}</strong>
                                                                </div>
                                                            </div>

                                                            {chain.votingDeadline > 0 && (
                                                                <p className="cd-voting-countdown">
                                                                    <Clock3 size={15} />
                                                                    {Number(chain.votingDeadline) > Math.floor(Date.now() / 1000)
                                                                        ? `Voting closes in ${formatCountdown(chain.votingDeadline)}`
                                                                        : "Voting period has ended. Finalization is available."}
                                                                </p>
                                                            )}

                                                            {!isCreator && (
                                                                <>
                                                                    {!votingInfo[index]?.walletAddress ? (
                                                                        <p className="cd-voting-hint">
                                                                            Connect your eligible donor wallet on Sepolia to check voting access.
                                                                        </p>
                                                                    ) : !votingInfo[index]?.isEligible ? (
                                                                        <p className="cd-voting-hint">
                                                                            Only wallets that contributed to this campaign can vote.
                                                                        </p>
                                                                    ) : votingInfo[index]?.alreadyVoted ? (
                                                                        <p className="cd-voting-hint">
                                                                            <CheckCircle2 size={15} /> Your vote has already been recorded for this round.
                                                                        </p>
                                                                    ) : Number(chain.votingDeadline) <= Math.floor(Date.now() / 1000) ? (
                                                                        <p className="cd-voting-hint">
                                                                            The voting period has ended. Votes can no longer be changed.
                                                                        </p>
                                                                    ) : (
                                                                        <div className="cd-vote-actions">
                                                                            <button
                                                                                type="button"
                                                                                className="cd-vote-button cd-vote-approve"
                                                                                onClick={() => handleMilestoneVote(index, true)}
                                                                                disabled={votingAction !== null}
                                                                            >
                                                                                {votingAction === `${index}-vote`
                                                                                    ? <LoaderCircle className="loading-icon" size={16} />
                                                                                    : <CheckCircle2 size={16} />}
                                                                                Approve
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                className="cd-vote-button cd-vote-reject"
                                                                                onClick={() => handleMilestoneVote(index, false)}
                                                                                disabled={votingAction !== null}
                                                                            >
                                                                                Reject
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}

                                                            {Number(chain.votingDeadline) <= Math.floor(Date.now() / 1000) && (
                                                                <button
                                                                    type="button"
                                                                    className="cd-primary-button"
                                                                    onClick={() => handleFinalizeMilestone(index)}
                                                                    disabled={votingAction !== null}
                                                                >
                                                                    {votingAction === `${index}-finalize`
                                                                        ? <><LoaderCircle className="loading-icon" size={16} /> Finalizing...</>
                                                                        : "Finalize milestone vote"}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}

                                                    {isCreator && status === "Approved" && (
                                                        <div className="cd-release-panel">
                                                            <p>This milestone passed the donor vote. Release its allocated funds to the campaign creator wallet.</p>
                                                            <button type="button" className="cd-primary-button" onClick={() => handleReleaseMilestone(index)} disabled={votingAction !== null}>
                                                                {votingAction === `${index}-release` ? <><LoaderCircle className="loading-icon" size={16} /> Releasing...</> : "Release milestone funds"}
                                                            </button>
                                                        </div>
                                                    )}

                                                    {isCreator && fundingProgress < 100 && (
                                                        <div className="cd-evidence-locked">
                                                            <LockKeyhole size={18} />
                                                            <div>
                                                                <strong>Evidence submission locked</strong>
                                                                <p>
                                                                    Milestone evidence submission will unlock
                                                                    once the campaign reaches its funding goal.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {isCreator && fundingProgress >= 100 &&
                                                        ["Pending", "Rejected"].includes(status) &&
                                                        (chain?.rejectionCount ?? 0) < 2 && (
                                                        <div className="cd-evidence-form">
                                                            <h4>Submit milestone evidence</h4>
                                                            <p>Upload a photo or PDF documenting the completed work. Maximum 10 MB.</p>
                                                            <label className="cd-file-picker">
                                                                <UploadCloud size={18} />
                                                                <span>{file ? file.name : "Choose JPG, PNG, WEBP or PDF"}</span>
                                                                <input
                                                                    type="file"
                                                                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                                                                    onChange={(event) => setSelectedFiles((current) => ({
                                                                        ...current,
                                                                        [milestone.id]: event.target.files?.[0] || null,
                                                                    }))}
                                                                    disabled={submittingMilestone !== null}
                                                                />
                                                            </label>
                                                            <textarea
                                                                value={evidenceDescriptions[milestone.id] || ""}
                                                                onChange={(event) => setEvidenceDescriptions((current) => ({
                                                                    ...current,
                                                                    [milestone.id]: event.target.value,
                                                                }))}
                                                                placeholder="Explain what this evidence demonstrates..."
                                                                disabled={submittingMilestone !== null}
                                                            />
                                                            <button
                                                                type="button"
                                                                className="cd-primary-button"
                                                                onClick={() => handleEvidenceSubmit(milestone, index)}
                                                                disabled={submittingMilestone !== null || !file ||
                                                                    !evidenceDescriptions[milestone.id]?.trim()}
                                                            >
                                                                {submittingMilestone === milestone.id
                                                                    ? <><LoaderCircle className="loading-icon" size={16} /> Submitting...</>
                                                                    : <><UploadCloud size={16} /> Submit evidence on-chain</>}
                                                            </button>
                                                        </div>
                                                    )}
                                                </article>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {evidenceMessage && <p className="cd-donation-success" role="status">{evidenceMessage}</p>}
                            {evidenceError && <p className="cd-donation-error" role="alert">{evidenceError}</p>}
                            {votingMessage && <p className="cd-donation-success" role="status">{votingMessage}</p>}
                            {votingError && <p className="cd-donation-error" role="alert">{votingError}</p>}
                        </div>

                        <div className="cd-section">
                            <p className="cd-section-eyebrow">ON-CHAIN CONTRIBUTIONS</p>
                            <h2>Recent donations</h2>
                            {donations.length === 0 ? (
                                <div className="cd-no-milestones">
                                    <Heart size={22} /><p>No verified donations yet. Be the first to support this project.</p>
                                </div>
                            ) : (
                                <div className="cd-donation-list">
                                    {donations.map((donation) => (
                                        <div className="cd-donation-item" key={donation.id}>
                                            <div>
                                                <strong>{donation.is_anonymous ? "Anonymous supporter" : shortAddress(donation.wallet_address)}</strong>
                                                <span>{formatDate(donation.created_at)}</span>
                                            </div>
                                            <div className="cd-donation-right">
                                                <strong>{formatETH(donation.amount_wei)}</strong>
                                                <a href={`https://sepolia.etherscan.io/tx/${donation.tx_hash}`} target="_blank" rel="noreferrer">
                                                    Transaction <ExternalLink size={13} />
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <aside className="cd-sidebar">
                        <div className="cd-support-card">
                            <p className="cd-section-eyebrow">SUPPORT THE VISION</p>
                            <h3>Every contribution matters.</h3>
                            <p>Help this project move one step closer to becoming reality.</p>
                            <div className="cd-goal-box">
                                <span>Campaign funding goal</span>
                                <strong>{formatETH(campaign.target_amount_wei)}</strong>
                            </div>
                            <label htmlFor="cd-donation-input">Donation amount (ETH)</label>
                            <input
                                id="cd-donation-input"
                                type="number"
                                min="0.000001"
                                step="0.001"
                                placeholder="e.g. 0.01"
                                value={donationAmount}
                                onChange={(event) => setDonationAmount(event.target.value)}
                                disabled={donating || campaign.status !== "active"}
                            />
                            <button
                                className="cd-primary-button cd-full-button"
                                type="button"
                                onClick={handleDonate}
                                disabled={donating || campaign.status !== "active"}
                            >
                                {donating ? <LoaderCircle className="loading-icon" size={17} /> : <Heart size={16} />}
                                {donating ? "Processing donation..." : "Donate with MetaMask"}
                            </button>
                            {donationMessage && <p className="cd-donation-success" role="status">{donationMessage}</p>}
                            {donationError && <p className="cd-donation-error" role="alert">{donationError}</p>}
                            <p className="cd-sidebar-note"><LockKeyhole size={13} /> Sepolia testnet transaction</p>
                        </div>

                        {campaign.status === "failed" && (
                            <div className="cd-info-card cd-refund-card">
                                <h3>Campaign refund</h3>
                                <p>This campaign is marked as failed. Donors may claim any refund available to their connected wallet under the smart contract rules.</p>
                                <button type="button" className="cd-primary-button cd-full-button" onClick={handleClaimRefund} disabled={votingAction !== null}>
                                    {votingAction === "refund" ? <><LoaderCircle className="loading-icon" size={16} /> Claiming...</> : "Claim donor refund"}
                                </button>
                            </div>
                        )}

                        <div className="cd-info-card">
                            <h3>Campaign information</h3>
                            <div><span>Category</span><strong>{campaign.category || "Not specified"}</strong></div>
                            <div><span>Created</span><strong>{formatDate(campaign.created_at)}</strong></div>
                            <div><span>Deadline</span><strong>{formatDate(campaign.deadline)}</strong></div>
                            <div><span>Status</span><strong className="cd-active-status">{campaign.status}</strong></div>
                        </div>
                    </aside>
                </section>
            </main>
            <Footer />
        </div>
    );
}
