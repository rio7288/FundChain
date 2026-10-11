// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Educational crowdfunding MVP. Review and audit before any real-fund use.
contract FundChain {
    uint256 public campaignCount;

    struct Campaign {
        uint256 id;
        address payable creator;
        string title;
        string description;
        string imageUrl;
        uint256 goalWei;
        uint256 deadline;
        uint256 raisedWei;
        bool withdrawn;
    }

    mapping(uint256 => Campaign) private campaigns;
    mapping(uint256 => mapping(address => uint256)) public donations;
    mapping(uint256 => address[]) private donors;
    mapping(uint256 => uint256) private campaignBalances;

    event CampaignCreated(uint256 indexed id, address indexed creator, uint256 goalWei, uint256 deadline);
    event DonationMade(uint256 indexed id, address indexed donor, uint256 amountWei);
    event FundsWithdrawn(uint256 indexed id, address indexed creator, uint256 amountWei);
    event RefundClaimed(uint256 indexed id, address indexed donor, uint256 amountWei);

    function createCampaign(
        string calldata title,
        string calldata description,
        string calldata imageUrl,
        uint256 goalWei,
        uint256 deadline
    ) external returns (uint256 id) {
        require(bytes(title).length > 0 && bytes(title).length <= 100, "Title required (max 100 chars)");
        require(bytes(description).length > 0 && bytes(description).length <= 2000, "Description required (max 2000 chars)");
        require(goalWei > 0, "Goal must be positive");
        require(deadline > block.timestamp, "Deadline must be in the future");

        id = ++campaignCount;
        campaigns[id] = Campaign({
            id: id,
            creator: payable(msg.sender),
            title: title,
            description: description,
            imageUrl: imageUrl,
            goalWei: goalWei,
            deadline: deadline,
            raisedWei: 0,
            withdrawn: false
        });
        emit CampaignCreated(id, msg.sender, goalWei, deadline);
    }

    function donate(uint256 id) external payable {
        Campaign storage c = campaigns[id];
        require(c.id != 0, "Campaign does not exist");
        require(block.timestamp < c.deadline, "Campaign has ended");
        require(!c.withdrawn, "Funds already withdrawn");
        require(msg.value > 0, "Donation must be positive");

        if (donations[id][msg.sender] == 0) donors[id].push(msg.sender);
        donations[id][msg.sender] += msg.value;
        c.raisedWei += msg.value;
        campaignBalances[id] += msg.value;
        emit DonationMade(id, msg.sender, msg.value);
    }

    function withdraw(uint256 id) external {
        Campaign storage c = campaigns[id];
        require(c.id != 0, "Campaign does not exist");
        require(msg.sender == c.creator, "Only creator can withdraw");
        require(!c.withdrawn, "Already withdrawn");
        require(c.raisedWei >= c.goalWei, "Funding goal not reached");

        c.withdrawn = true;
        uint256 amount = campaignBalances[id];
        campaignBalances[id] = 0;
        (bool ok, ) = c.creator.call{value: amount}("");
        require(ok, "Transfer failed");
        emit FundsWithdrawn(id, c.creator, amount);
    }

    function refund(uint256 id) external {
        Campaign storage c = campaigns[id];
        require(c.id != 0, "Campaign does not exist");
        require(block.timestamp >= c.deadline, "Campaign is still active");
        require(c.raisedWei < c.goalWei, "Funding goal was reached");
        uint256 amount = donations[id][msg.sender];
        require(amount > 0, "No donation to refund");

        donations[id][msg.sender] = 0;
        campaignBalances[id] -= amount;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Refund transfer failed");
        emit RefundClaimed(id, msg.sender, amount);
    }

    function getCampaign(uint256 id) external view returns (Campaign memory) {
        require(campaigns[id].id != 0, "Campaign does not exist");
        return campaigns[id];
    }

    function getDonors(uint256 id) external view returns (address[] memory) {
        return donors[id];
    }

    function getDonation(uint256 id, address donor) external view returns (uint256) {
        return donations[id][donor];
    }

    function getCampaignBalance(uint256 id) external view returns (uint256) {
        return campaignBalances[id];
    }

    // Keep a separate balance per campaign so one campaign cannot withdraw another's funds.
    receive() external payable { revert("Use donate(campaignId)"); }
}
