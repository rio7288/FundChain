// After deployment, paste your deployed contract address here.

export const CONTRACT_ADDRESS = "0x598Ac69f050fbb269D4Dcee23628Cb0305Da18Eb";

export const CONTRACT_ABI = [
  "function campaignCount() view returns (uint256)",
  "function createCampaign(string title,string description,string imageUrl,uint256 goalWei,uint256 deadline) returns (uint256)",
  "function donate(uint256 id) payable",
  "function withdraw(uint256 id)",
  "function refund(uint256 id)",
  "function getCampaign(uint256 id) view returns (tuple(uint256 id,address creator,string title,string description,string imageUrl,uint256 goalWei,uint256 deadline,uint256 raisedWei,bool withdrawn))",
  "function getDonation(uint256 id,address donor) view returns (uint256)",
  "event CampaignCreated(uint256 indexed id,address indexed creator,uint256 goalWei,uint256 deadline)",
  "event DonationMade(uint256 indexed id,address indexed donor,uint256 amountWei)",
  "event FundsWithdrawn(uint256 indexed id,address indexed creator,uint256 amountWei)",
  "event RefundClaimed(uint256 indexed id,address indexed donor,uint256 amountWei)"
];
