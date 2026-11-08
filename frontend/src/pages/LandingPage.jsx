import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp, Eye, HandHeart, LockKeyhole, ShieldCheck, Vote } from "lucide-react";
import { formatEther } from "ethers";
import { supabase } from "../services/supabase";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const faqs = [
    { q: "What is FundChain?", a: "FundChain is a crowdfunding platform designed to connect people with projects they believe in. Its planned blockchain features are intended to make campaign milestones and funding activity easier to verify." },
    { q: "How does crowdfunding work on FundChain?", a: "Campaign creators share a project, a funding goal and proposed milestones. Supporters can discover projects and, as the relevant features become available, contribute and follow progress." },
    { q: "How can I create a campaign?", a: "Create an account, sign in and open your dashboard. Use Create Campaign to submit your project details, funding goal, deadline and milestones. Campaign creation currently saves a draft in the platform database." },
    { q: "Do I need MetaMask to use FundChain?", a: "You can register and sign in with email and password. MetaMask is optional for account access and is used for wallet linking and future blockchain interactions." },
    { q: "Which blockchain network does FundChain support?", a: "The current development integration targets the Ethereum Sepolia test network. Sepolia uses test ETH and is not intended for real-value fundraising." },
    { q: "How can I contribute to a project?", a: "Project discovery is being developed. On-chain donations are not yet enabled, so please do not send funds to a campaign or wallet address based on this preview." },
    { q: "Where does my contributed money go?", a: "The intended model is for contributions to be handled by the campaign's smart contract and released according to its rules. Real contribution flows are not yet live." },
    { q: "What are funding milestones?", a: "Milestones divide a campaign into planned stages. A creator can describe what each stage will deliver and the amount associated with it." },
    { q: "How does community voting work?", a: "The planned model allows contributors to vote on submitted milestone evidence before a milestone withdrawal is approved. Voting is not yet active in the current application." },
    { q: "What happens if a milestone is rejected?", a: "The intended smart-contract workflow will define what happens after a rejected milestone, including any resubmission or refund rules. Those contract rules must be implemented and tested before this can be offered." },
    { q: "Can contributors request refunds?", a: "A refund mechanism is part of the project plan, but refunds are not currently available because on-chain donations and the final contract workflow are not live." },
    { q: "How can I track my transactions?", a: "Once blockchain transactions are enabled, transaction hashes can be checked using a Sepolia block explorer. The current draft workflow does not create donation transactions." },
    { q: "Are transactions recorded on the blockchain?", a: "Wallet signatures used for wallet verification do not require a blockchain transaction. Campaign drafts are stored in Supabase. Future contract transactions will be recorded on Sepolia." },
    { q: "Does FundChain charge platform fees?", a: "No platform fee schedule has been established yet. Any fees will need to be clearly disclosed before real fundraising is enabled." }
];

function CampaignCard({ campaign }) {
    let goal = "Goal not available";
    try {
        if (campaign.target_amount_wei) goal = `${Number(formatEther(BigInt(campaign.target_amount_wei))).toLocaleString("en-US", { maximumFractionDigits: 4 })} ETH goal`;
    } catch { /* Keep the unavailable label if the stored amount cannot be parsed. */ }

    return (
        <article className="project-card">
            <div className="project-image-wrap">
                {campaign.image_url ? <img src={campaign.image_url} alt="" className="project-image" loading="lazy" /> : <div className="project-image-placeholder"><span>FC</span></div>}
                <span className="project-category">{campaign.category || "Community project"}</span>
            </div>
            <div className="project-copy">
                <h3>{campaign.title}</h3>
                <p>{campaign.description || "A project shared with the FundChain community."}</p>
                <div className="project-meta"><span>{goal}</span><span>Active project</span></div>
                <span className="project-data-note">Funding and contributor totals will appear when on-chain contributions are enabled.</span>
            </div>
        </article>
    );
}

export default function LandingPage() {
    const [campaigns, setCampaigns] = useState([]);
    const [campaignState, setCampaignState] = useState("loading");
    const [openFaq, setOpenFaq] = useState(0);

    useEffect(() => {
        let mounted = true;
        async function loadCampaigns() {
            const { data, error } = await supabase
                .from("campaigns")
                .select("id,title,description,category,image_url,target_amount_wei,deadline,created_at")
                .eq("status", "active")
                .order("created_at", { ascending: false })
                .limit(3);
            if (!mounted) return;
            if (error) {
                console.error("Could not load featured campaigns:", error.message);
                setCampaignState("error");
                return;
            }
            setCampaigns(data || []);
            setCampaignState(data?.length ? "ready" : "empty");
        }
        loadCampaigns();
        return () => { mounted = false; };
    }, []);

    return (
        <div className="fundchain-site">
            <Navbar />
            <main>
                <section className="hero-section">
                    <div className="hero-copy">
                        <p className="eyebrow"><span className="eyebrow-line" /> FUNDING WHAT MATTERS</p>
                        <h1>Ideas deserve a chance to <em>become reality.</em></h1>
                        <p className="hero-description">FundChain brings people and meaningful ideas together through transparent, blockchain-powered crowdfunding. Support projects, follow their milestones and become part of something bigger.</p>
                        <div className="hero-actions">
                            <Link className="button button-dark" to="/explore-projects">Explore projects <ArrowUpRight size={16} /></Link>
                            <Link className="button button-outline" to="/create-campaign">Start a campaign <ArrowRight size={16} /></Link>
                        </div>
                        <div className="hero-footnote"><span className="hero-dot" /> Built for people who believe in what comes next</div>
                    </div>
                    <div className="hero-visual">
                        <img src="https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1500&q=88" alt="A group of people coming together around a shared community project" className="hero-photo" fetchPriority="high" />
                        <div className="hero-image-shade" />
                        <div className="hero-caption"><span>GOOD THINGS GROW TOGETHER</span><span>01 / 03</span></div>
                        <div className="hero-glass-note"><span className="glass-note-icon"><HandHeart size={18} /></span><span><strong>People-powered progress</strong><small>One idea. A community behind it.</small></span></div>
                    </div>
                    <a className="scroll-cue" href="#featured"><ArrowDown size={15} /> SCROLL TO DISCOVER</a>
                </section>

                <section className="featured-section section-pad" id="featured">
                    <div className="section-heading-row"><div><p className="eyebrow">A PLACE TO BEGIN</p><h2>Projects with a <em>purpose.</em></h2></div><p className="section-intro">Discover the ideas taking shape in our community. Every meaningful change starts somewhere.</p></div>
                    {campaignState === "loading" ? <div className="campaign-empty">Finding projects to share…</div> : null}
                    {campaignState === "ready" ? <div className="project-grid">{campaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}</div> : null}
                    {campaignState === "empty" ? <div className="campaign-empty"><div className="empty-icon"><HandHeart size={23} /></div><h3>The next great idea could start here.</h3><p>There are no active public campaigns just yet. Have something worth building? Start with a draft and bring your idea to the community.</p><Link to="/create-campaign" className="text-link">Create the first campaign <ArrowUpRight size={15} /></Link></div> : null}
                    {campaignState === "error" ? <div className="campaign-empty"><h3>Projects are taking a little longer to load.</h3><p>Please check back soon. You can still learn how FundChain is designed to work below.</p></div> : null}
                </section>

                <section className="how-section section-pad" id="how-it-works">
                    <div className="section-heading-row"><div><p className="eyebrow">A CLEARER WAY FORWARD</p><h2>From first spark to <em>shared impact.</em></h2></div><p className="section-intro">A considered process that gives creators a plan and supporters a clearer view of the journey.</p></div>
                    <div className="steps-grid">
                        {[{ n: "01", title: "Create a campaign", body: "Share the idea, set a funding goal and outline the milestones that will move it forward.", icon: <HandHeart /> }, { n: "02", title: "Community contributes", body: "Bring people who believe in your idea together around a common purpose.", icon: <Eye /> }, { n: "03", title: "Track the milestones", body: "Make progress visible through clear stages, updates and supporting evidence.", icon: <Check /> }, { n: "04", title: "Transparent releases", body: "The planned contract workflow ties fund releases to milestone decisions and defined rules.", icon: <ShieldCheck /> }].map((step) => <div className="step-item" key={step.n}><div className="step-top"><span>{step.n}</span><div className="step-icon">{step.icon}</div></div><h3>{step.title}</h3><p>{step.body}</p></div>)}
                    </div>
                    <p className="implementation-note">Note: campaign drafts and wallet linking are available in the current build. On-chain contributions, milestone voting and contract-based withdrawals are still under development.</p>
                </section>

                <section className="about-section section-pad" id="about">
                    <div className="about-image"><img src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=85" alt="Friends and collaborators spending time together outdoors" loading="lazy" /></div>
                    <div className="about-copy"><p className="eyebrow">WHY FUNDCHAIN</p><h2>Trust should be part of the <em>foundation.</em></h2><p>Good ideas need more than funding. They need clarity, accountability and people who can see how the work is progressing.</p><div className="principle-list"><div><span><ShieldCheck size={19} /></span><p><strong>Designed for transparency</strong><small>Blockchain records are intended to make eligible activity verifiable.</small></p></div><div><span><Vote size={19} /></span><p><strong>Community at the centre</strong><small>Milestone voting is planned to give contributors a voice in project progress.</small></p></div><div><span><LockKeyhole size={19} /></span><p><strong>Rules before release</strong><small>Smart contracts are planned to enforce clearly defined funding conditions.</small></p></div></div><Link to="/create-campaign" className="text-link">Be part of what comes next <ArrowUpRight size={15} /></Link></div>
                </section>

                <section className="faq-section section-pad" id="faq">
                    <div className="faq-heading"><p className="eyebrow">GOOD QUESTIONS, CLEAR ANSWERS</p><h2>Before you <em>begin.</em></h2><p>Here are a few things people often want to know about FundChain.</p><div className="faq-help"><CircleHelp size={18} /><span>Still curious? The platform is evolving as features are built and tested.</span></div></div>
                    <div className="faq-list">{faqs.map((faq, index) => <div className={`faq-item${openFaq === index ? " is-open" : ""}`} key={faq.q}><button className="faq-question" onClick={() => setOpenFaq(openFaq === index ? -1 : index)} aria-expanded={openFaq === index}><span><small>{String(index + 1).padStart(2, "0")}</small>{faq.q}</span><ChevronDown size={18} /></button>{openFaq === index && <div className="faq-answer"><p>{faq.a}</p></div>}</div>)}</div>
                </section>

                <section className="closing-section"><div><p className="eyebrow">YOUR IDEA HAS A PLACE HERE</p><h2>Make room for what <em>could be.</em></h2><p>Start with a thought. Bring people into it. See where it can go.</p></div><Link to="/create-campaign" className="button button-light">Get started with FundChain <ArrowUpRight size={16} /></Link></section>
            </main>
            <Footer />
        </div>
    );
}