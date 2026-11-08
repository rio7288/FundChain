import "../styles/campaign.css";
import { publishCampaignOnChain } from "../services/blockchain";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { parseEther, formatEther } from "ethers";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    ImagePlus,
    Plus,
    Trash2,
    Wallet,
    Upload,
    X
} from "lucide-react";

import { supabase } from "../services/supabase";
import { connectAndVerifyWallet } from "../services/wallet";
import "../styles/auth.css";

const API_URL = import.meta.env.VITE_API_URL;

const categories = [
    "Education",
    "Healthcare",
    "Technology",
    "Environment",
    "Social",
    "Business",
    "Other"
];

const initialMilestone = {
    title: "",
    description: "",
    amountEth: ""
};

export default function CreateCampaign() {
    const navigate = useNavigate();

    const [step, setStep] = useState(1);
    const [wallet, setWallet] = useState("");
    const [walletLoading, setWalletLoading] = useState(false);

    const [form, setForm] = useState({
        title: "",
        description: "",
        category: "Education",
        targetEth: "",
        deadline: ""
    });

    const [milestones, setMilestones] = useState([
        { ...initialMilestone }
    ]);

    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    // Keep the saved draft and successful transaction in memory for safe retries.
    const [savedDraft, setSavedDraft] = useState(null);
    const [pendingPublication, setPendingPublication] = useState(null);



    const updateForm = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
    };

    const updateMilestone = (index, field, value) => {
        setMilestones((current) =>
            current.map((milestone, i) =>
                i === index
                    ? { ...milestone, [field]: value }
                    : milestone
            )
        );
    };

    const addMilestone = () => {
        if (milestones.length >= 10) return;

        setMilestones((current) => [
            ...current,
            { ...initialMilestone }
        ]);
    };

    const removeMilestone = (index) => {
        if (milestones.length <= 1) return;

        setMilestones((current) =>
            current.filter((_, i) => i !== index)
        );
    };

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];

        if (!file) return;

        setError("");

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.type)) {
            setError("Please select a JPG, PNG or WebP image.");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError("Image size must be less than 5 MB.");
            return;
        }

        if (imagePreview) {
            URL.revokeObjectURL(imagePreview);
        }

        setImage(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const handleWalletConnect = async () => {
        setWalletLoading(true);
        setError("");

        try {
            const result = await connectAndVerifyWallet();

            setWallet(result.walletAddress);
            setMessage("Your Sepolia wallet has been verified.");
            setStep(2);
        } catch (err) {
            setError(err.message || "Wallet connection failed.");
        } finally {
            setWalletLoading(false);
        }
    };

    const validateCampaign = () => {
        if (form.title.trim().length < 5) {
            throw new Error("Campaign title must contain at least 5 characters.");
        }

        if (form.description.trim().length < 30) {
            throw new Error("Please write at least 30 characters describing your campaign.");
        }

        if (!form.targetEth || !form.deadline) {
            throw new Error("Please enter a funding target and deadline.");
        }

        if (new Date(form.deadline).getTime() <= Date.now()) {
            throw new Error("Your campaign deadline must be in the future.");
        }

        if (milestones.length < 1) {
            throw new Error("Add at least one campaign milestone.");
        }

        let targetWei;
        let totalMilestoneWei = 0n;

        try {
            targetWei = parseEther(form.targetEth);

            for (const milestone of milestones) {
                if (
                    milestone.title.trim().length < 3 ||
                    !milestone.amountEth
                ) {
                    throw new Error("Complete every milestone title and amount.");
                }

                totalMilestoneWei += parseEther(milestone.amountEth);
            }
        } catch (err) {
            if (err.message.includes("Complete every")) throw err;

            throw new Error("Enter valid ETH amounts with up to 18 decimal places.");
        }

        if (targetWei <= 0n) {
            throw new Error("Funding target must be greater than zero.");
        }

        if (totalMilestoneWei !== targetWei) {
            throw new Error(
                `Milestone total must equal the campaign target. Current milestone total: ${formatEther(totalMilestoneWei)} ETH.`
            );
        }

        return true;
    };

    const handleContinue = () => {
        setError("");

        try {
            validateCampaign();
            setStep(3);
        } catch (err) {
            setError(err.message);
        }
    };

    const handlePublish = async () => {
        setLoading(true);
        setError("");
        setMessage("");

        let draft = savedDraft;
        let uploadedImagePath = null;

        try {
            validateCampaign();

            const {
                data: { session },
                error: sessionError
            } = await supabase.auth.getSession();

            if (sessionError || !session) {
                throw new Error("Your login session has expired. Please log in again.");
            }

            if (!wallet) {
                throw new Error("Please connect and verify your Sepolia wallet first.");
            }


            // Save the Supabase draft once. Reuse it on retries.
            if (!draft) {
                let imageUrl = null;

                if (image) {
                    const extension = image.name.split(".").pop().toLowerCase();
                    uploadedImagePath =
                        `${session.user.id}/${crypto.randomUUID()}.${extension}`;

                    const { error: uploadError } = await supabase.storage
                        .from("campaign-images")
                        .upload(uploadedImagePath, image, {
                            cacheControl: "3600",
                            upsert: false,
                            contentType: image.type
                        });

                    if (uploadError) throw uploadError;

                    const { data: publicData } = supabase.storage
                        .from("campaign-images")
                        .getPublicUrl(uploadedImagePath);

                    imageUrl = publicData.publicUrl;
                }

                const response = await fetch(`${API_URL}/campaigns`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        title: form.title.trim(),
                        description: form.description.trim(),
                        category: form.category,
                        targetEth: form.targetEth,
                        deadline: new Date(form.deadline).toISOString(),
                        imageUrl,
                        milestones: milestones.map((milestone) => ({
                            title: milestone.title.trim(),
                            description: milestone.description.trim(),
                            amountEth: milestone.amountEth
                        }))
                    })
                });

                const result = await response.json();

                if (!response.ok || !result.campaign) {
                    throw new Error(
                        result.message || "Campaign draft could not be saved."
                    );
                }

                draft = result.campaign;
                setSavedDraft(draft);
                setMessage(
                    "Your draft is saved. Confirm the Sepolia transaction in MetaMask to publish it."
                );
            }

            // Publish using FundChain V2.
            // Reuse a successful transaction if backend verification needs retrying.
            let publication = pendingPublication;

            if (!publication) {
                publication = await publishCampaignOnChain({
                    campaign: {
                        ...draft,
                        targetEth: form.targetEth
                    },
                    milestones,
                    expectedWallet: wallet
                });

                setPendingPublication(publication);
            }

            // Backend independently verifies the existing transaction before activation.
            const publishResponse = await fetch(
                `${API_URL}/campaigns/${draft.id}/publish`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        transactionHash: publication.transactionHash,
                        ...(publication.contractCampaignId !== undefined
                            ? { contractCampaignId: publication.contractCampaignId }
                            : {}),
                        creatorWallet: publication.creatorWallet
                    })
                }
            );

            const publishResult = await publishResponse.json();

            if (!publishResponse.ok || !publishResult.success) {
                throw new Error(
                    publishResult.message ||
                    "The blockchain transaction succeeded, but backend verification failed. Retry without creating another draft."
                );
            }

            setMessage("Your campaign has been verified on Sepolia and published.");

            navigate("/my-campaigns", {
                replace: true,
                state: {
                    campaignCreated: true,
                    campaign: publishResult.campaign
                }
            });
        } catch (err) {
            console.error("Campaign publishing error:", err);

            // Remove the image only if the campaign draft was never created.
            if (!draft && uploadedImagePath) {
                const { error: removeError } = await supabase.storage
                    .from("campaign-images")
                    .remove([uploadedImagePath]);

                if (removeError) {
                    console.error("Could not remove unused image:", removeError);
                }
            }

            if (draft) {
                setSavedDraft(draft);
                setError(
                    `Your campaign draft is saved (ID: ${draft.id}). ${err.message} Retry publishing; do not create another campaign.`
                );
            } else {
                setError(err.message || "Something went wrong.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="campaign-page">

            <header className="campaign-header">
                <Link to="/dashboard" className="campaign-brand">
                    <span className="campaign-brand-mark">F</span>
                    FundChain
                </Link>

                <Link to="/dashboard" className="campaign-back">
                    <ArrowLeft size={16} />
                    Back to workspace
                </Link>
            </header>

            <div className="campaign-container">

                <div className="campaign-heading">
                    <p className="auth-eyebrow">BRING YOUR IDEA TO LIFE</p>
                    <h1>Create a <em>campaign.</em></h1>
                    <p>
                        A good idea deserves a clear plan and people who believe in it.
                    </p>
                </div>

                <div className="campaign-progress">
                    {[
                        "Connect wallet",
                        "Campaign details",
                        "Review"
                    ].map((label, index) => (
                        <div
                            key={label}
                            className={`campaign-progress-step ${
                                step >= index + 1 ? "active" : ""
                            }`}
                        >
                            <span>
                                {step > index + 1
                                    ? <Check size={15} />
                                    : `0${index + 1}`}
                            </span>
                            <small>{label}</small>
                        </div>
                    ))}
                </div>

                <section className="campaign-form-card">

                    {step === 1 && (
                        <div className="campaign-wallet-step">
                            <div className="campaign-icon">
                                <Wallet size={27} />
                            </div>

                            <p className="auth-eyebrow">STEP 01</p>
                            <h2>Connect your wallet.</h2>

                            <p>
                                Connect your MetaMask wallet to verify ownership
                                before creating your campaign.
                            </p>

                            <div className="campaign-network-note">
                                <span />
                                Ethereum Sepolia test network
                            </div>

                            {wallet && (
                                <p className="campaign-wallet-address">
                                    {wallet}
                                </p>
                            )}

                            <button
                                className="campaign-primary-button"
                                onClick={handleWalletConnect}
                                disabled={walletLoading}
                            >
                                <Wallet size={17} />
                                {walletLoading
                                    ? "Connecting wallet..."
                                    : "Connect MetaMask"}
                                <ArrowRight size={17} />
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div>
                            <p className="auth-eyebrow">STEP 02</p>
                            <h2>Tell us about your idea.</h2>
                            <p className="campaign-section-description">
                                Give supporters a clear picture of what you want to build.
                            </p>

                            <div className="campaign-form">

                                <div className="campaign-field">
                                    <label>Campaign title</label>
                                    <input
                                        name="title"
                                        value={form.title}
                                        onChange={updateForm}
                                        placeholder="Give your project a name"
                                        maxLength={150}
                                    />
                                </div>

                                <div className="campaign-field">
                                    <label>Campaign description</label>
                                    <textarea
                                        name="description"
                                        value={form.description}
                                        onChange={updateForm}
                                        placeholder="What are you building? Why does it matter? How will the funds help?"
                                        rows={6}
                                        maxLength={10000}
                                    />
                                </div>

                                <div className="campaign-field">
                                    <label>Category</label>
                                    <select
                                        name="category"
                                        value={form.category}
                                        onChange={updateForm}
                                    >
                                        {categories.map((category) => (
                                            <option key={category}>
                                                {category}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="campaign-two-columns">
                                    <div className="campaign-field">
                                        <label>Funding target (ETH)</label>
                                        <input
                                            name="targetEth"
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={form.targetEth}
                                            onChange={updateForm}
                                            placeholder="e.g. 1"
                                        />
                                    </div>

                                    <div className="campaign-field">
                                        <label>Campaign deadline</label>
                                        <input
                                            name="deadline"
                                            type="datetime-local"
                                            value={form.deadline}
                                            onChange={updateForm}
                                        />
                                    </div>
                                </div>

                                <div className="campaign-field">
                                    <label>Campaign cover photo (optional)</label>

                                    <label className="campaign-upload">
                                        {imagePreview ? (
                                            <img
                                                src={imagePreview}
                                                alt="Campaign preview"
                                            />
                                        ) : (
                                            <>
                                                <ImagePlus size={27} />
                                                <strong>Choose a campaign image</strong>
                                                <small>JPG, PNG or WebP · Maximum 5 MB</small>
                                            </>
                                        )}

                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            onChange={handleImageChange}
                                            hidden
                                        />
                                    </label>

                                    {image && (
                                        <button
                                            type="button"
                                            className="campaign-remove-image"
                                            onClick={() => {
                                                URL.revokeObjectURL(imagePreview);
                                                setImage(null);
                                                setImagePreview("");
                                            }}
                                        >
                                            <X size={14} /> Remove image
                                        </button>
                                    )}
                                </div>

                                <div className="campaign-milestones-heading">
                                    <div>
                                        <p className="auth-eyebrow">FUNDING PLAN</p>
                                        <h3>Campaign milestones</h3>
                                        <p>
                                            Divide your funding target into clear stages.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        className="campaign-add-button"
                                        onClick={addMilestone}
                                        disabled={milestones.length >= 10}
                                    >
                                        <Plus size={16} /> Add milestone
                                    </button>
                                </div>

                                {milestones.map((milestone, index) => (
                                    <div
                                        className="campaign-milestone"
                                        key={index}
                                    >
                                        <div className="campaign-milestone-top">
                                            <strong>
                                                Milestone {String(index + 1).padStart(2, "0")}
                                            </strong>

                                            {milestones.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeMilestone(index)}
                                                    aria-label="Remove milestone"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="campaign-field">
                                            <label>Milestone title</label>
                                            <input
                                                value={milestone.title}
                                                onChange={(e) =>
                                                    updateMilestone(
                                                        index,
                                                        "title",
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="e.g. Build the foundation"
                                            />
                                        </div>

                                        <div className="campaign-field">
                                            <label>Description</label>
                                            <textarea
                                                rows={2}
                                                value={milestone.description}
                                                onChange={(e) =>
                                                    updateMilestone(
                                                        index,
                                                        "description",
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="What will be completed in this stage?"
                                            />
                                        </div>

                                        <div className="campaign-field">
                                            <label>Allocated amount (ETH)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="any"
                                                value={milestone.amountEth}
                                                onChange={(e) =>
                                                    updateMilestone(
                                                        index,
                                                        "amountEth",
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="e.g. 0.4"
                                            />
                                        </div>
                                    </div>
                                ))}

                                <div className="campaign-form-actions">
                                    <button
                                        type="button"
                                        className="campaign-secondary-button"
                                        onClick={() => setStep(1)}
                                    >
                                        <ArrowLeft size={16} /> Back
                                    </button>

                                    <button
                                        type="button"
                                        className="campaign-primary-button"
                                        onClick={handleContinue}
                                    >
                                        Review campaign <ArrowRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div>
                            <p className="auth-eyebrow">STEP 03</p>
                            <h2>Review your campaign.</h2>
                            <p className="campaign-section-description">
                                Check your information before saving the draft.
                            </p>

                            <div className="campaign-review">
                                {imagePreview && (
                                    <img
                                        src={imagePreview}
                                        alt="Campaign cover"
                                        className="campaign-review-image"
                                    />
                                )}

                                <p className="auth-eyebrow">{form.category}</p>
                                <h3>{form.title}</h3>
                                <p>{form.description}</p>

                                <div className="campaign-review-target">
                                    <span>Funding target</span>
                                    <strong>{form.targetEth} ETH</strong>
                                </div>

                                <div className="campaign-review-target">
                                    <span>Deadline</span>
                                    <strong>
                                        {new Date(form.deadline).toLocaleString()}
                                    </strong>
                                </div>

                                <h3>Milestones</h3>

                                {milestones.map((milestone, index) => (
                                    <div
                                        className="campaign-review-milestone"
                                        key={index}
                                    >
                                        <div>
                                            <strong>{milestone.title}</strong>
                                            <p>{milestone.description}</p>
                                        </div>
                                        <strong>{milestone.amountEth} ETH</strong>
                                    </div>
                                ))}

                                <div className="campaign-wallet-address">
                                    Verified wallet: {wallet}
                                </div>
                            </div>



                            <div className="campaign-form-actions">
                                <button
                                    type="button"
                                    className="campaign-secondary-button"
                                    onClick={() => setStep(2)}
                                    disabled={loading}
                                >
                                    <ArrowLeft size={16} /> Edit details
                                </button>

                                <button
                                    type="button"
                                    className="campaign-primary-button"
                                    onClick={handlePublish}
                                    disabled={loading}
                                >
                                    {loading
                                        ? "Publishing campaign..."
                                        : savedDraft
                                            ? "Retry publishing"
                                            : "Publish campaign"}
                                    {!loading && <Check size={17} />}
                                </button>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div
                            className="campaign-error"
                            role="alert"
                        >
                            {error}
                        </div>
                    )}

                    {message && (
                        <div className="campaign-success">
                            {message}
                        </div>
                    )}

                </section>

                <p className="campaign-disclaimer">
                    Your campaign is published only after its Sepolia transaction
                    is independently verified by the FundChain backend.
                    Use Sepolia test ETH only.
                </p>

            </div>
        </main>
    );
}
