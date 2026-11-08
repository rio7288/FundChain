
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatEther, parseEther } from "ethers";
import {
    ArrowLeft,
    Plus,
    RefreshCw,
    FolderOpen,
    Pencil,
    Trash2,
    X,
    Save
} from "lucide-react";

import { supabase } from "../services/supabase";
import { useAuth } from "../context/AuthContext";
import "../styles/my-campaigns.css";

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

// =========================================
// FORMAT HELPERS
// =========================================

function formatGoal(value) {
    try {
        return value
            ? `${Number(
                formatEther(BigInt(value))
            ).toLocaleString("en-IN", {
                maximumFractionDigits: 4
            })} ETH`
            : "Not set";
    } catch {
        return "Unavailable";
    }
}

function formatDate(value) {
    if (!value) return "No deadline";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? "Invalid date"
        : date.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
}

function toDateTimeLocal(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const local = new Date(
        date.getTime() - date.getTimezoneOffset() * 60000
    );

    return local.toISOString().slice(0, 16);
}

function campaignToForm(campaign) {
    const sortedMilestones = [...(campaign.milestones || [])]
        .sort((a, b) => a.sequence_number - b.sequence_number);

    return {
        title: campaign.title || "",
        description: campaign.description || "",
        category: campaign.category || "Education",
        targetEth: formatEther(
            BigInt(campaign.target_amount_wei || "0")
        ),
        deadline: toDateTimeLocal(campaign.deadline),
        imageUrl: campaign.image_url || null,

        milestones: sortedMilestones.map((item) => ({
            title: item.title || "",
            description: item.description || "",
            amountEth: formatEther(
                BigInt(item.amount_wei || "0")
            )
        }))
    };
}

// =========================================
// MY CAMPAIGNS COMPONENT
// =========================================

export default function MyCampaigns() {
    const { user, loading: authLoading } = useAuth();

    const [campaigns, setCampaigns] = useState([]);
    const [state, setState] = useState("loading");
    const [error, setError] = useState("");

    const [editing, setEditing] = useState(null);
    const [editForm, setEditForm] = useState(null);

    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    const [actionMessage, setActionMessage] = useState("");

    // =========================================
    // AUTHENTICATION
    // =========================================

    async function getAccessToken() {
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (!data.session) {
            throw new Error(
                "Your session has expired. Please log in again."
            );
        }

        return data.session.access_token;
    }

    // =========================================
    // LOAD CAMPAIGNS
    // =========================================

    async function loadCampaigns() {
        if (!user?.id) return;

        setState("loading");
        setError("");

        const { data, error: queryError } = await supabase
            .from("campaigns")
            .select(`
                id,
                title,
                description,
                category,
                image_url,
                target_amount_wei,
                deadline,
                status,
                created_at,
                is_deleted,
                milestones (
                    id,
                    title,
                    description,
                    amount_wei,
                    sequence_number,
                    status
                )
            `)
            .eq("creator_id", user.id)
            .eq("is_deleted", false)
            .order("created_at", { ascending: false });

        if (queryError) {
            console.error(
                "Could not load campaigns:",
                queryError
            );

            setError(queryError.message);
            setState("error");
            return;
        }

        setCampaigns(data || []);
        setState(data?.length ? "ready" : "empty");
    }

    useEffect(() => {
        if (authLoading) return;

        if (user?.id) {
            loadCampaigns();
        } else {
            setState("empty");
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, user?.id]);

    // =========================================
    // EDIT CAMPAIGN
    // =========================================

    function startEditing(campaign) {
        try {
            setEditing(campaign);
            setEditForm(campaignToForm(campaign));

            setActionMessage("");
            setError("");
        } catch {
            setError(
                "This campaign contains invalid ETH or milestone data and cannot be edited."
            );
        }
    }

    function updateEditField(event) {
        const { name, value } = event.target;

        setEditForm((current) => ({
            ...current,
            [name]: value
        }));
    }

    function updateEditMilestone(index, field, value) {
        setEditForm((current) => ({
            ...current,
            milestones: current.milestones.map((milestone, i) =>
                i === index
                    ? { ...milestone, [field]: value }
                    : milestone
            )
        }));
    }

    function addEditMilestone() {
        if (editForm.milestones.length >= 10) return;

        setEditForm((current) => ({
            ...current,
            milestones: [
                ...current.milestones,
                {
                    title: "",
                    description: "",
                    amountEth: ""
                }
            ]
        }));
    }

    function removeEditMilestone(index) {
        if (editForm.milestones.length <= 1) return;

        setEditForm((current) => ({
            ...current,
            milestones: current.milestones.filter(
                (_, i) => i !== index
            )
        }));
    }

    // =========================================
    // SAVE DRAFT
    // =========================================

    async function saveDraft(event) {
        event.preventDefault();

        if (!editing || !editForm) return;

        setSaving(true);
        setError("");
        setActionMessage("");

        try {
            if (editForm.title.trim().length < 5) {
                throw new Error(
                    "Campaign title must contain at least 5 characters."
                );
            }

            if (editForm.description.trim().length < 30) {
                throw new Error(
                    "Description must contain at least 30 characters."
                );
            }

            if (
                !editForm.deadline ||
                new Date(editForm.deadline).getTime() <= Date.now()
            ) {
                throw new Error(
                    "Choose a deadline in the future."
                );
            }

            if (!editForm.milestones.length) {
                throw new Error(
                    "Add at least one milestone."
                );
            }

            const targetWei = parseEther(editForm.targetEth);

            if (targetWei <= 0n) {
                throw new Error(
                    "Funding target must be greater than zero."
                );
            }

            let milestoneTotal = 0n;

            const milestones = editForm.milestones.map((milestone) => {
                if (
                    milestone.title.trim().length < 3 ||
                    !milestone.amountEth
                ) {
                    throw new Error(
                        "Complete every milestone title and amount."
                    );
                }

                const amountWei = parseEther(
                    milestone.amountEth
                );

                if (amountWei <= 0n) {
                    throw new Error(
                        "Milestone amounts must be greater than zero."
                    );
                }

                milestoneTotal += amountWei;

                return {
                    title: milestone.title.trim(),
                    description: milestone.description.trim(),
                    amountEth: milestone.amountEth
                };
            });

            if (milestoneTotal !== targetWei) {
                throw new Error(
                    "Milestone amounts must add up exactly to the campaign funding target."
                );
            }

            const accessToken = await getAccessToken();

            const response = await fetch(
                `${API_URL}/campaigns/${editing.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({
                        title: editForm.title.trim(),
                        description: editForm.description.trim(),
                        category: editForm.category,
                        targetEth: editForm.targetEth,
                        deadline: new Date(
                            editForm.deadline
                        ).toISOString(),
                        imageUrl: editForm.imageUrl,
                        milestones
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Could not update campaign."
                );
            }

            setActionMessage(
                "Your campaign draft has been updated."
            );

            setEditing(null);
            setEditForm(null);

            await loadCampaigns();

        } catch (err) {
            setError(
                err.message || "Could not update campaign."
            );
        } finally {
            setSaving(false);
        }
    }

    // =========================================
    // SOFT DELETE CAMPAIGN
    // =========================================

    async function deleteCampaign(campaign) {
        const confirmed = window.confirm(
            `Remove "${campaign.title}" from FundChain?\n\n` +
            "It will disappear from your campaigns and public listings. " +
            "Donation records and milestones will be preserved."
        );

        if (!confirmed) return;

        setDeletingId(campaign.id);
        setError("");
        setActionMessage("");

        try {
            const { error } = await supabase.rpc(
                "soft_delete_campaign",
                {
                    p_campaign_id: campaign.id
                }
            );

            if (error) throw error;

            setActionMessage(
                `"${campaign.title}" has been removed successfully.`
            );

            if (editing?.id === campaign.id) {
                setEditing(null);
                setEditForm(null);
            }

            await loadCampaigns();

        } catch (err) {
            console.error(
                "Campaign deletion failed:",
                err
            );

            setError(
                err.message || "Could not remove campaign."
            );
        } finally {
            setDeletingId(null);
        }
    }

    // =========================================
    // CAMPAIGN STATISTICS
    // =========================================

    const drafts = campaigns.filter(
        (item) => item.status === "draft"
    ).length;

    const active = campaigns.filter(
        (item) => item.status === "active"
    ).length;

    // =========================================
    // LOADING
    // =========================================

    if (authLoading) {
        return (
            <main className="my-campaigns-page">
                <p>Loading your account…</p>
            </main>
        );
    }

    // =========================================
    // MAIN PAGE
    // =========================================

    return (
        <main className="my-campaigns-page">
            <div className="my-campaigns-container">

                <Link
                    to="/dashboard"
                    className="my-campaigns-back"
                >
                    <ArrowLeft size={16} />
                    Back to dashboard
                </Link>

                {/* Header */}

                <header className="my-campaigns-header">
                    <div>
                        <p className="my-campaigns-eyebrow">
                            YOUR WORK, IN ONE PLACE
                        </p>

                        <h1>
                            My <em>campaigns.</em>
                        </h1>

                        <p className="my-campaigns-intro">
                            Keep track of the ideas you have started
                            and the projects you are building.
                        </p>
                    </div>

                    <Link
                        to="/create-campaign"
                        className="my-campaigns-create"
                    >
                        <Plus size={17} />
                        Create campaign
                    </Link>
                </header>

                {/* Statistics */}

                <section className="my-campaigns-stats">
                    <div>
                        <span>Total campaigns</span>
                        <strong>{campaigns.length}</strong>
                    </div>

                    <div>
                        <span>Drafts</span>
                        <strong>{drafts}</strong>
                    </div>

                    <div>
                        <span>Active</span>
                        <strong>{active}</strong>
                    </div>
                </section>

                {/* Feedback */}

                {actionMessage && (
                    <p
                        className="my-campaigns-action-success"
                        role="status"
                    >
                        {actionMessage}
                    </p>
                )}

                {error && (
                    <p
                        className="my-campaigns-action-error"
                        role="alert"
                    >
                        {error}
                    </p>
                )}

                {/* List heading */}

                <div className="my-campaigns-list-heading">
                    <div>
                        <p className="my-campaigns-eyebrow">
                            CAMPAIGN LIBRARY
                        </p>

                        <h2>Your projects</h2>
                    </div>

                    <button
                        className="my-campaigns-refresh"
                        onClick={loadCampaigns}
                        disabled={!user?.id || state === "loading"}
                    >
                        <RefreshCw size={15} />
                        Refresh
                    </button>
                </div>

                {/* Loading state */}

                {state === "loading" && (
                    <div className="my-campaigns-message">
                        Loading your campaigns…
                    </div>
                )}

                {/* Error state */}

                {state === "error" && (
                    <div className="my-campaigns-message my-campaigns-error">
                        <h3>
                            We couldn't load your campaigns.
                        </h3>

                        <p>{error}</p>

                        <button onClick={loadCampaigns}>
                            Try again
                        </button>
                    </div>
                )}

                {/* Empty state */}

                {state === "empty" && (
                    <div className="my-campaigns-empty">
                        <div className="my-campaigns-empty-icon">
                            <FolderOpen size={25} />
                        </div>

                        <h3>No campaigns yet.</h3>

                        <p>
                            Your campaign drafts and projects will
                            appear here after you create them.
                        </p>

                        <Link
                            to="/create-campaign"
                            className="my-campaigns-create"
                        >
                            <Plus size={17} />
                            Create your first campaign
                        </Link>
                    </div>
                )}

                {/* Campaign cards */}

                {state === "ready" && (
                    <div className="my-campaigns-grid">
                        {campaigns.map((campaign) => (
                            <article
                                className="my-campaign-card"
                                key={campaign.id}
                            >
                                <div className="my-campaign-card-image">
                                    {campaign.image_url ? (
                                        <img
                                            src={campaign.image_url}
                                            alt=""
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="my-campaign-placeholder">
                                            FC
                                        </div>
                                    )}

                                    <span
                                        className={`my-campaign-status status-${campaign.status || "unknown"}`}
                                    >
                                        {campaign.status || "Unknown"}
                                    </span>
                                </div>

                                <div className="my-campaign-card-content">
                                    <p className="my-campaign-category">
                                        {campaign.category || "Community project"}
                                    </p>

                                    <h3>{campaign.title}</h3>

                                    <p className="my-campaign-description">
                                        {campaign.description || "No description added."}
                                    </p>

                                    <div className="my-campaign-card-meta">
                                        <div>
                                            <span>Funding goal</span>
                                            <strong>
                                                {formatGoal(campaign.target_amount_wei)}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Deadline</span>
                                            <strong>
                                                {formatDate(campaign.deadline)}
                                            </strong>
                                        </div>
                                    </div>

                                    <div className="my-campaign-card-footer">
                                        <span>
                                            Created {formatDate(campaign.created_at)}
                                        </span>

                                        <span>
                                            {campaign.status === "draft"
                                                ? "Not publicly listed"
                                                : "Campaign record"}
                                        </span>
                                    </div>

                                    {/* Campaign actions */}

                                    <div className="my-campaign-actions">

                                        {campaign.status === "draft" && (
                                            <button
                                                type="button"
                                                onClick={() => startEditing(campaign)}
                                            >
                                                <Pencil size={14} />
                                                Edit draft
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            className="my-campaign-delete"
                                            onClick={() => deleteCampaign(campaign)}
                                            disabled={deletingId === campaign.id}
                                        >
                                            <Trash2 size={14} />

                                            {deletingId === campaign.id
                                                ? "Removing…"
                                                : "Delete"}
                                        </button>

                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                {/* Footnote */}

                <p className="my-campaigns-footnote">
                    You can remove campaigns from public listings
                    whenever needed. Campaign records, milestones
                    and donation history are preserved.
                </p>
            </div>

            {/* =========================================
                EDIT CAMPAIGN MODAL
            ========================================= */}

            {editing && editForm && (
                <div
                    className="my-campaign-edit-overlay"
                    role="presentation"
                >
                    <section
                        className="my-campaign-edit-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="edit-campaign-title"
                    >
                        <div className="my-campaign-edit-heading">
                            <div>
                                <p className="my-campaigns-eyebrow">
                                    DRAFT MANAGEMENT
                                </p>

                                <h2 id="edit-campaign-title">
                                    Edit campaign
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setEditing(null);
                                    setEditForm(null);
                                    setError("");
                                }}
                                aria-label="Close edit form"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form
                            onSubmit={saveDraft}
                            className="my-campaign-edit-form"
                        >
                            <label>
                                Campaign title

                                <input
                                    name="title"
                                    value={editForm.title}
                                    onChange={updateEditField}
                                    maxLength={150}
                                    required
                                />
                            </label>

                            <label>
                                Description

                                <textarea
                                    name="description"
                                    value={editForm.description}
                                    onChange={updateEditField}
                                    rows={5}
                                    maxLength={10000}
                                    required
                                />
                            </label>

                            <label>
                                Category

                                <select
                                    name="category"
                                    value={editForm.category}
                                    onChange={updateEditField}
                                >
                                    {categories.map((category) => (
                                        <option key={category}>
                                            {category}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="my-campaign-edit-two-col">
                                <label>
                                    Funding target (ETH)

                                    <input
                                        name="targetEth"
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={editForm.targetEth}
                                        onChange={updateEditField}
                                        required
                                    />
                                </label>

                                <label>
                                    Deadline

                                    <input
                                        name="deadline"
                                        type="datetime-local"
                                        value={editForm.deadline}
                                        onChange={updateEditField}
                                        required
                                    />
                                </label>
                            </div>

                            {/* Milestones */}

                            <div className="my-campaign-edit-milestone-heading">
                                <strong>Milestones</strong>

                                <button
                                    type="button"
                                    onClick={addEditMilestone}
                                    disabled={editForm.milestones.length >= 10}
                                >
                                    + Add milestone
                                </button>
                            </div>

                            {editForm.milestones.map((milestone, index) => (
                                <div
                                    className="my-campaign-edit-milestone"
                                    key={index}
                                >
                                    <div className="my-campaign-edit-milestone-top">
                                        <strong>
                                            Milestone {index + 1}
                                        </strong>

                                        {editForm.milestones.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeEditMilestone(index)}
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>

                                    <label>
                                        Title

                                        <input
                                            value={milestone.title}
                                            onChange={(e) =>
                                                updateEditMilestone(
                                                    index,
                                                    "title",
                                                    e.target.value
                                                )
                                            }
                                            required
                                        />
                                    </label>

                                    <label>
                                        Description

                                        <textarea
                                            rows={2}
                                            value={milestone.description}
                                            onChange={(e) =>
                                                updateEditMilestone(
                                                    index,
                                                    "description",
                                                    e.target.value
                                                )
                                            }
                                        />
                                    </label>

                                    <label>
                                        Amount (ETH)

                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={milestone.amountEth}
                                            onChange={(e) =>
                                                updateEditMilestone(
                                                    index,
                                                    "amountEth",
                                                    e.target.value
                                                )
                                            }
                                            required
                                        />
                                    </label>
                                </div>
                            ))}

                            {/* Form feedback */}

                            {error && (
                                <p
                                    className="my-campaigns-action-error"
                                    role="alert"
                                >
                                    {error}
                                </p>
                            )}

                            {/* Modal actions */}

                            <div className="my-campaign-edit-actions">
                                <button
                                    type="button"
                                    className="my-campaign-edit-cancel"
                                    onClick={() => {
                                        setEditing(null);
                                        setEditForm(null);
                                        setError("");
                                    }}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="my-campaign-edit-save"
                                    disabled={saving}
                                >
                                    <Save size={15} />

                                    {saving
                                        ? "Saving…"
                                        : "Save changes"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </main>
    );
}
