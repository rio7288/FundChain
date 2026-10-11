import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ethers } from 'ethers';
import { ArrowUpRight, BadgeCheck, Blocks, ChevronDown, CircleDollarSign, Clock3, Compass, ExternalLink, Heart, Layers3, Menu, Plus, RefreshCw, ShieldCheck, Sparkles, Wallet, X } from 'lucide-react';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from './contract';
import './styles.css';

const SEPOLIA_CHAIN_ID = 11155111;
const isConfigured = ethers.isAddress(CONTRACT_ADDRESS);
const money = (wei) => Number(ethers.formatEther(wei || 0n)).toLocaleString('en-US', { maximumFractionDigits: 3 });
const shortAddress = (address) => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '';
const timeLeft = (timestamp) => {
  const seconds = Number(timestamp) - Math.floor(Date.now() / 1000);
  if (seconds <= 0) return 'Ended';
  const days = Math.floor(seconds / 86400);
  if (days) return `${days} day${days === 1 ? '' : 's'} left`;
  const hours = Math.floor(seconds / 3600);
  return `${hours} hour${hours === 1 ? '' : 's'} left`;
};
const demoCampaigns = [
  { id: 'demo-1', title: 'A brighter classroom for every child', description: 'Help a community school bring books, learning kits, and a safe study space to students who need them most.', imageUrl: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1000&q=85', goalWei: ethers.parseEther('3'), raisedWei: ethers.parseEther('2.12'), deadline: BigInt(Math.floor(Date.now()/1000)+864000), creator: '0x0000000000000000000000000000000000000001', withdrawn: false },
  { id: 'demo-2', title: 'Solar power for a rural clinic', description: 'Support reliable, clean electricity for essential medical equipment and evening care.', imageUrl: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1000&q=85', goalWei: ethers.parseEther('5'), raisedWei: ethers.parseEther('3.6'), deadline: BigInt(Math.floor(Date.now()/1000)+432000), creator: '0x0000000000000000000000000000000000000002', withdrawn: false },
  { id: 'demo-3', title: 'Open-source tools for local farmers', description: 'Build accessible digital tools that help small farms plan crops, reduce waste, and share knowledge.', imageUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=85', goalWei: ethers.parseEther('2'), raisedWei: ethers.parseEther('0.94'), deadline: BigInt(Math.floor(Date.now()/1000)+172800), creator: '0x0000000000000000000000000000000000000003', withdrawn: false }
];

function App() {
  const [account, setAccount] = useState('');
  const [chainId, setChainId] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All campaigns');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', imageUrl: '', goal: '1', days: '14' });

  const getWriteContract = useCallback(async () => {
    if (!window.ethereum) throw new Error('Install MetaMask to continue.');
    if (!isConfigured) throw new Error('Contract not configured yet. Deploy FundChain and add its address to frontend/src/contract.js.');
    const p = new ethers.BrowserProvider(window.ethereum);
    const network = await p.getNetwork();
    if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) throw new Error('Switch MetaMask to the Sepolia test network first.');
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, await p.getSigner());
  }, []);

  const refreshCampaigns = useCallback(async () => {
    if (!isConfigured) { setCampaigns(demoCampaigns); return; }
    setLoading(true);
    try {
      const response = await fetch(`/api/campaigns?address=${encodeURIComponent(CONTRACT_ADDRESS)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not load campaigns.');
      setCampaigns(payload.campaigns.map((campaign) => ({
        ...campaign,
        goalWei: BigInt(campaign.goalWei),
        deadline: BigInt(campaign.deadline),
        raisedWei: BigInt(campaign.raisedWei),
      })));
    } catch (e) { setError(e.shortMessage || e.message || 'Could not load campaigns.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refreshCampaigns(); }, [refreshCampaigns]);
  useEffect(() => {
    if (!window.ethereum) return;
    const update = async () => {
      try {
        const p = new ethers.BrowserProvider(window.ethereum);
        const network = await p.getNetwork(); setChainId(Number(network.chainId));
        const accounts = await p.send('eth_accounts', []); setAccount(accounts[0] || '');
      } catch { /* wallet can remain disconnected */ }
    };
    update();
    window.ethereum.on?.('accountsChanged', (accounts) => setAccount(accounts[0] || ''));
    window.ethereum.on?.('chainChanged', () => window.location.reload());
    return () => {
      window.ethereum.removeListener?.('accountsChanged', update);
      window.ethereum.removeListener?.('chainChanged', update);
    };
  }, []);

  async function connectWallet() {
    setError(''); setMessage('');
    try {
      if (!window.ethereum) throw new Error('MetaMask is not installed. Install the browser extension first.');
      const p = new ethers.BrowserProvider(window.ethereum);
      const accounts = await p.send('eth_requestAccounts', []);
      const network = await p.getNetwork(); setChainId(Number(network.chainId)); setAccount(accounts[0] || '');
      if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) setMessage('Wallet connected. Switch to Sepolia to make test transactions.');
    } catch (e) { setError(e.shortMessage || e.message || 'Wallet connection failed.'); }
  }

  async function createCampaign(e) {
    e.preventDefault(); setError(''); setMessage('');
    try {
      const contract = await getWriteContract();
      const goal = Number(form.goal); const days = Number(form.days);
      if (!form.title.trim() || !form.description.trim()) throw new Error('Add a title and description.');
      if (!Number.isFinite(goal) || goal <= 0) throw new Error('Funding goal must be greater than zero.');
      if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('Choose a deadline between 1 and 365 days.');
      const deadline = Math.floor(Date.now()/1000) + days * 86400;
      setMessage('Confirm campaign creation in MetaMask…');
      const tx = await contract.createCampaign(form.title.trim(), form.description.trim(), form.imageUrl.trim(), ethers.parseEther(String(goal)), deadline);
      setMessage('Transaction submitted. Waiting for confirmation…'); await tx.wait();
      setShowCreate(false); setForm({ title: '', description: '', imageUrl: '', goal: '1', days: '14' });
      setMessage('Campaign created successfully.'); await refreshCampaigns();
    } catch (e) { setError(e.shortMessage || e.message || 'Campaign creation failed.'); setMessage(''); }
  }

  async function donate(campaign) {
    const amount = window.prompt(`Donation amount in Sepolia ETH for “${campaign.title}”`, '0.01');
    if (amount === null) return;
    try {
      setError(''); setMessage('');
      const contract = await getWriteContract();
      if (!amount.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) throw new Error('Enter a valid donation amount.');
      setMessage('Confirm donation in MetaMask…');
      const tx = await contract.donate(campaign.id, { value: ethers.parseEther(amount.trim()) });
      setMessage('Donation submitted. Waiting for confirmation…'); await tx.wait();
      setMessage('Thank you! Your donation is confirmed on-chain.'); await refreshCampaigns();
    } catch (e) { setError(e.shortMessage || e.message || 'Donation failed.'); setMessage(''); }
  }

  async function campaignAction(campaign, action) {
    try {
      setError(''); setMessage('');
      const contract = await getWriteContract();
      setMessage(`Confirm ${action} in MetaMask…`);
      const tx = action === 'withdraw' ? await contract.withdraw(campaign.id) : await contract.refund(campaign.id);
      setMessage('Transaction submitted. Waiting for confirmation…'); await tx.wait();
      setMessage(action === 'withdraw' ? 'Funds withdrawn successfully.' : 'Refund claimed successfully.'); await refreshCampaigns();
    } catch (e) { setError(e.shortMessage || e.message || `${action} failed.`); setMessage(''); }
  }

  const visibleCampaigns = campaigns.filter(c => `${c.title} ${c.description}`.toLowerCase().includes(search.toLowerCase()));
  const totalRaised = campaigns.reduce((sum, c) => sum + c.raisedWei, 0n);
  const totalGoal = campaigns.reduce((sum, c) => sum + c.goalWei, 0n);

  return <div className="app-shell">
    <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
    <header className="topbar">
      <a href="#home" className="brand"><span className="brand-mark"><Blocks size={21}/></span><span>fund<span className="brand-accent">chain</span><small>COMMUNITY, ON-CHAIN</small></span></a>
      <nav className={mobileMenu ? 'nav-links open' : 'nav-links'}><a href="#explore" onClick={() => setMobileMenu(false)}>Explore</a><a href="#how-it-works" onClick={() => setMobileMenu(false)}>How it works</a><a href="#transparency" onClick={() => setMobileMenu(false)}>Transparency</a></nav>
      <div className="header-actions"><button className="btn btn-quiet create-top" onClick={() => setShowCreate(true)}><Plus size={16}/> Create campaign</button><button className="btn btn-wallet" onClick={connectWallet}><Wallet size={16}/>{account ? shortAddress(account) : 'Connect wallet'}</button><button className="icon-btn mobile-toggle" aria-label="Toggle menu" onClick={() => setMobileMenu(v => !v)}>{mobileMenu ? <X/> : <Menu/>}</button></div>
    </header>

    <main id="home">
      {!isConfigured && <div className="notice"><Sparkles size={17}/><span><strong>Preview mode</strong> — these are sample campaigns. Deploy the contract and configure its address to enable real testnet actions.</span></div>}
      {chainId && chainId !== SEPOLIA_CHAIN_ID && account && <div className="notice warning"><Compass size={17}/><span>Switch MetaMask to the <strong>Sepolia test network</strong> to create campaigns or donate.</span></div>}
      {message && <div className="toast success"><BadgeCheck size={17}/><span>{message}</span><button onClick={() => setMessage('')} aria-label="Dismiss"><X size={15}/></button></div>}
      {error && <div className="toast danger"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss"><X size={15}/></button></div>}

      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span className="live-dot"/> DECENTRALIZED CROWDFUNDING</div><h1>Big ideas deserve<br/>a <span>community.</span></h1><p className="hero-sub">Fund the future you believe in. Support meaningful projects with transparent, blockchain-powered contributions.</p><div className="hero-buttons"><a href="#explore" className="btn btn-primary">Explore campaigns <ArrowUpRight size={17}/></a><button className="btn btn-secondary" onClick={() => setShowCreate(true)}><Plus size={17}/> Start a campaign</button></div><div className="hero-trust"><div className="avatar-stack"><span>F</span><span>C</span><span>+</span></div><div><strong>Powered by people</strong><small>Transparent by design. Community at heart.</small></div></div></div>
        <div className="hero-visual"><div className="orbit orbit-a"/><div className="orbit orbit-b"/><div className="hero-glow"/><div className="hero-art-card"><div className="art-top"><span className="art-icon"><Layers3 size={19}/></span><span className="tag tag-green">ON-CHAIN</span></div><div className="art-visual"><div className="art-sun"/><div className="art-hill hill-back"/><div className="art-hill hill-front"/><div className="art-path"/></div><div className="art-bottom"><span>Ideas grow together.</span><span className="art-arrow"><ArrowUpRight size={19}/></span></div></div><div className="float-chip chip-top"><span className="chip-icon"><ShieldCheck size={16}/></span><span><strong>Verifiable</strong><small>Every contribution</small></span></div><div className="float-chip chip-bottom"><span className="chip-icon green"><Heart size={16}/></span><span><strong>Community first</strong><small>Small gifts. Big impact.</small></span></div><div className="hero-orb orb-left"/><div className="hero-orb orb-right"/></div>
      </section>

      <section className="stats-row"><div className="stat"><span className="stat-icon"><CircleDollarSign size={19}/></span><div><small>Tracked on-chain</small><strong>{isConfigured ? `${money(totalRaised)} ETH` : 'Live on testnet'}</strong></div></div><div className="stat"><span className="stat-icon"><Layers3 size={19}/></span><div><small>Campaigns</small><strong>{campaigns.length}</strong></div></div><div className="stat"><span className="stat-icon"><ShieldCheck size={19}/></span><div><small>Built for transparency</small><strong>Open records</strong></div></div><div className="stats-note"><span className="live-dot"/> {isConfigured ? 'Connected to campaign contract' : 'Preview experience'}</div></section>

      <section className="campaign-section" id="explore"><div className="section-heading"><div><div className="eyebrow">DISCOVER YOUR NEXT WHY</div><h2>Campaigns worth <span>believing in.</span></h2><p>Find a cause that moves you. Every contribution helps make it real.</p></div><button className="btn btn-secondary desktop-create" onClick={() => setShowCreate(true)}><Plus size={17}/> Launch a campaign</button></div>
        <div className="filter-bar"><div className="search-box"><Compass size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search campaigns..." aria-label="Search campaigns"/><kbd>⌘ K</kbd></div><div className="filter-right"><span className="result-count">{visibleCampaigns.length} campaigns</span><button className="btn btn-quiet refresh-btn" onClick={refreshCampaigns}><RefreshCw size={15}/> Refresh</button></div></div>
        {loading ? <div className="empty-state"><RefreshCw className="spin"/><p>Loading campaigns from the blockchain…</p></div> : visibleCampaigns.length === 0 ? <div className="empty-state"><Layers3 size={30}/><h3>No campaigns found</h3><p>Try another search or create the first campaign.</p><button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={16}/> Create campaign</button></div> : <div className="campaign-grid">{visibleCampaigns.map((c, index) => {
          const raised = Number(ethers.formatEther(c.raisedWei)); const goal = Number(ethers.formatEther(c.goalWei)); const percent = Math.min(100, goal ? raised / goal * 100 : 0); const ended = Number(c.deadline) <= Math.floor(Date.now()/1000); const demo = typeof c.id === 'string' && c.id.startsWith('demo-'); const failed = ended && c.raisedWei < c.goalWei;
          return <article className="campaign-card" key={c.id}><div className="campaign-image-wrap"><img src={c.imageUrl || 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=1000&q=80'} alt="Campaign" onError={e => { e.currentTarget.src = 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=1000&q=80'; }}/><span className="category-pill"><span className="category-dot"/>{index % 3 === 0 ? 'Community' : index % 3 === 1 ? 'Clean energy' : 'Innovation'}</span><button className="save-btn" title="Save campaign (demo)"><Heart size={17}/></button></div><div className="campaign-body"><div className="creator-line"><span className="creator-avatar">{c.creator.slice(2,4).toUpperCase()}</span><span>By <strong>{shortAddress(c.creator)}</strong></span><BadgeCheck size={14} className="verified"/></div><h3>{c.title}</h3><p className="campaign-desc">{c.description}</p><div className="progress-meta"><span><strong>{money(c.raisedWei)} ETH</strong> raised</span><span>{Math.round(percent)}%</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${percent}%` }}/></div><div className="campaign-foot"><span className="time-left"><Clock3 size={14}/>{timeLeft(c.deadline)}</span><span>Goal <strong>{money(c.goalWei)} ETH</strong></span></div><div className="card-actions">{demo ? <button className="btn btn-primary card-donate" onClick={() => setMessage('Preview only: configure the deployed contract to make a real testnet donation.')}>Support campaign <ArrowUpRight size={16}/></button> : <button className="btn btn-primary card-donate" disabled={ended || c.withdrawn} onClick={() => donate(c)}>Support campaign <ArrowUpRight size={16}/></button>}{!demo && account && account.toLowerCase() === c.creator.toLowerCase() && !c.withdrawn && c.raisedWei >= c.goalWei && <button className="btn btn-secondary" onClick={() => campaignAction(c,'withdraw')}>Withdraw</button>}{!demo && failed && account && <button className="btn btn-secondary" onClick={() => campaignAction(c,'refund')}>Claim refund</button>}</div></div></article>;
        })}</div>}
      </section>

      <section className="how-section" id="how-it-works"><div className="section-heading centered"><div className="eyebrow">SIMPLE BY DESIGN</div><h2>From belief to <span>blockchain.</span></h2><p>Three simple steps to help a good idea move forward.</p></div><div className="steps-grid"><div className="step-card"><div className="step-number">01</div><div className="step-icon"><Compass size={23}/></div><h3>Find your cause</h3><p>Explore campaigns from people building something meaningful for their communities.</p></div><div className="step-card"><div className="step-number">02</div><div className="step-icon"><Wallet size={23}/></div><h3>Contribute directly</h3><p>Connect your wallet and send a contribution with a transaction you can verify.</p></div><div className="step-card"><div className="step-number">03</div><div className="step-icon"><ShieldCheck size={23}/></div><h3>Verify the journey</h3><p>Campaign and donation activity is recorded on-chain for public inspection.</p></div></div></section>

      <section className="transparency-banner" id="transparency"><div className="transparency-icon"><ShieldCheck size={25}/></div><div><div className="eyebrow">TRANSPARENCY IS THE FOUNDATION</div><h2>Trust is better when you can <span>verify it.</span></h2><p>FundChain uses smart contracts to enforce campaign rules. Transactions are public on the blockchain; campaign descriptions and real-world outcomes still require human verification.</p></div><a className="text-link" href="https://sepolia.etherscan.io/" target="_blank" rel="noreferrer">Explore Sepolia <ExternalLink size={15}/></a></section>
    </main>

    <footer className="footer"><a href="#home" className="brand"><span className="brand-mark"><Blocks size={19}/></span><span>fund<span className="brand-accent">chain</span><small>COMMUNITY, ON-CHAIN</small></span></a><p>Built with purpose. Powered by community.</p><span className="footer-status"><span className="live-dot"/> {isConfigured ? 'Contract configured' : 'Demo mode'}</span></footer>

    {showCreate && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setShowCreate(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-title"><div className="modal-header"><div><div className="eyebrow">YOUR IDEA STARTS HERE</div><h2 id="create-title">Create a campaign</h2></div><button className="icon-btn" onClick={() => setShowCreate(false)} aria-label="Close"><X/></button></div><form onSubmit={createCampaign} className="create-form"><label>Campaign title<input required maxLength="100" value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="What are you building?"/></label><label>Story and purpose<textarea required maxLength="2000" rows="4" value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder="Tell people why this matters…"/></label><label>Cover image URL <span className="optional">(optional)</span><input type="url" value={form.imageUrl} onChange={e => setForm({...form,imageUrl:e.target.value})} placeholder="https://example.com/image.jpg"/></label><div className="form-row"><label>Goal (ETH)<input required type="number" min="0.000001" step="any" value={form.goal} onChange={e => setForm({...form,goal:e.target.value})}/></label><label>Deadline<input required type="number" min="1" max="365" value={form.days} onChange={e => setForm({...form,days:e.target.value})}/><small>Days from now</small></label></div><div className="form-note"><ShieldCheck size={17}/><span>Campaigns are public on-chain. Use testnet ETH only while developing.</span></div><button className="btn btn-primary submit-btn" type="submit">Create campaign <ArrowUpRight size={17}/></button></form></section></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
