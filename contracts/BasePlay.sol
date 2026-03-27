// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BasePlayPrediction {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    struct Pool {
        string teamA;
        string teamB;
        uint256 deadline;
        uint256 totalA;
        uint256 totalB;
        bool resolved;
        uint8 winner;
    }

    uint256 public poolCount;
    mapping(uint256 => Pool) public pools;

    mapping(uint256 => mapping(address => uint256)) public betA;
    mapping(uint256 => mapping(address => uint256)) public betB;
    mapping(uint256 => mapping(address => bool)) public claimed;

    event PoolCreated(uint256 poolId, string teamA, string teamB, uint256 deadline);
    event BetPlaced(uint256 poolId, address user, uint8 side, uint256 amount);
    event ResultSet(uint256 poolId, uint8 winner);
    event Claimed(uint256 poolId, address user, uint256 reward);

    function createPool(
        string memory _teamA,
        string memory _teamB,
        uint256 _deadline
    ) external onlyOwner {
        require(_deadline > block.timestamp, "Invalid deadline");

        poolCount++;

        pools[poolCount] = Pool({
            teamA: _teamA,
            teamB: _teamB,
            deadline: _deadline,
            totalA: 0,
            totalB: 0,
            resolved: false,
            winner: 0
        });

        emit PoolCreated(poolCount, _teamA, _teamB, _deadline);
    }

    function bet(uint256 _poolId, uint8 _side) external payable {
        Pool storage p = pools[_poolId];

        require(block.timestamp < p.deadline, "Bet closed");
        require(msg.value > 0, "No ETH");
        require(_side == 1 || _side == 2, "Invalid side");

        if (_side == 1) {
            betA[_poolId][msg.sender] += msg.value;
            p.totalA += msg.value;
        } else {
            betB[_poolId][msg.sender] += msg.value;
            p.totalB += msg.value;
        }

        emit BetPlaced(_poolId, msg.sender, _side, msg.value);
    }

    function setResult(uint256 _poolId, uint8 _winner) external onlyOwner {
        Pool storage p = pools[_poolId];

        require(block.timestamp >= p.deadline, "Not finished");
        require(!p.resolved, "Already resolved");
        require(_winner == 1 || _winner == 2, "Invalid winner");

        p.resolved = true;
        p.winner = _winner;

        emit ResultSet(_poolId, _winner);
    }

    function claim(uint256 _poolId) external {
        Pool storage p = pools[_poolId];

        require(p.resolved, "Not resolved");
        require(!claimed[_poolId][msg.sender], "Already claimed");

        uint256 userBet;
        uint256 reward;
        uint256 totalPool = p.totalA + p.totalB;

        if (p.winner == 1) {
            userBet = betA[_poolId][msg.sender];
            require(userBet > 0, "No winning bet");
            reward = (userBet * totalPool) / p.totalA;
        } else {
            userBet = betB[_poolId][msg.sender];
            require(userBet > 0, "No winning bet");
            reward = (userBet * totalPool) / p.totalB;
        }

        claimed[_poolId][msg.sender] = true;
        payable(msg.sender).transfer(reward);

        emit Claimed(_poolId, msg.sender, reward);
    }

    function getPool(uint256 _poolId) external view returns (
        string memory,
        string memory,
        uint256,
        uint256,
        uint256,
        bool,
        uint8
    ) {
        Pool memory p = pools[_poolId];
        return (
            p.teamA,
            p.teamB,
            p.deadline,
            p.totalA,
            p.totalB,
            p.resolved,
            p.winner
        );
    }
}
