import { ArrowUpRight } from "lucide-react";
import Logo from "./Logo";

export default function Footer() {
    return (
        <footer className="site-footer">
            <div className="footer-main">
                <div className="footer-brand">
                    <Logo />
                    <p>A more thoughtful way to bring good ideas to life. Built around people, shared belief and transparent progress.</p>
                    <a className="footer-email" href="#faq">Read frequently asked questions <ArrowUpRight size={14} /></a>
                </div>
                <div className="footer-column"><h3>Discover</h3><a href="#featured">Explore projects</a><a href="#how-it-works">How it works</a><a href="#about">About FundChain</a></div>
                <div className="footer-column"><h3>Resources</h3><a href="#faq">Frequently asked questions</a><a href="#how-it-works">Getting started</a><a href="#faq">Platform guide</a></div>
                <div className="footer-column"><h3>Your account</h3><a href="/login">Log in</a><a href="/register">Create an account</a><a href="/login">Start a campaign <ArrowUpRight size={13} /></a></div>
            </div>
            <div className="footer-bottom"><span>© 2026 FundChain. Made for ideas with a future.</span><span className="footer-note">Blockchain-powered crowdfunding · Sepolia testnet</span></div>
        </footer>
    );
}
