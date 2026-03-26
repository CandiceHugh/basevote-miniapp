// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract BasePlay {
    address public owner;
    uint256 public poolCount;

    struct Pool {
        string title;
        string optionA;
        string optionB;
        uint256 deadline;
        bool settled;
        uint8 winningOption;
        uint256 totalA;
        uint256 totalB;
    }

    struct BetInfo {
        uint8 option;
        uint256 amount;
        bool claimed;
    }

    mapping(uint256 => Pool) private _pools;
    mapping(uint256 => mapping(address => BetInfo)) public bets;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PoolCreated(uint256 indexed poolId, string title, uint256 deadline);
    event BetPlaced(uint256 indexed poolId, address indexed user, uint8 option, uint256 amount);
    event PoolSettled(uint256 indexed poolId, uint8 winningOption);
    event Claimed(uint256 indexed poolId, address indexed user, uint256 payout);

    modifier onlyOwner() {
        require(msg.sender == owner, 'Only owner');
        _;
    }

    constructor(address initialOwner) {
        require(initialOwner != address(0), 'Invalid owner');
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function pools(uint256 poolId) external view returns (
        string memory title,
        string memory optionA,
        string memory optionB,
        uint256 deadline,
        bool settled,
        uint256 totalA,
        uint256 totalB
    ) {
        Pool storage pool = _pools[poolId];
        return (
            pool.title,
            pool.optionA,
            pool.optionB,
            pool.deadline,
            pool.settled,
            pool.totalA,
            pool.totalB
        );
    }

    function createPool(
        string calldata title,
        string calldata optionA,
        string calldata optionB,
        uint256 deadline
    ) external onlyOwner {
        require(bytes(title).length > 0, 'Title required');
        require(bytes(optionA).length > 0, 'Option A required');
        require(bytes(optionB).length > 0, 'Option B required');
        require(deadline > block.timestamp, 'Deadline must be future');

        uint256 poolId = poolCount;
        _pools[poolId] = Pool({
            title: title,
            optionA: optionA,
            optionB: optionB,
            deadline: deadline,
            settled: false,
            winningOption: 2,
            totalA: 0,
            totalB: 0
        });
        poolCount += 1;

        emit PoolCreated(poolId, title, deadline);
    }

    function bet(uint256 poolId, uint8 option) external payable {
        require(poolId < poolCount, 'Pool not found');
        require(msg.value > 0, 'Bet amount required');
        require(option == 0 || option == 1, 'Invalid option');

        Pool storage pool = _pools[poolId];
        require(block.timestamp < pool.deadline, 'Pool closed');
        require(!pool.settled, 'Pool settled');

        BetInfo storage info = bets[poolId][msg.sender];
        require(info.amount == 0, 'Already bet');

        info.option = option;
        info.amount = msg.value;
        info.claimed = false;

        if (option == 0) {
            pool.totalA += msg.value;
        } else {
            pool.totalB += msg.value;
        }

        emit BetPlaced(poolId, msg.sender, option, msg.value);
    }

    function settlePool(uint256 poolId, uint8 winningOption) external onlyOwner {
        require(poolId < poolCount, 'Pool not found');
        require(winningOption == 0 || winningOption == 1, 'Invalid option');

        Pool storage pool = _pools[poolId];
        require(block.timestamp >= pool.deadline, 'Pool still active');
        require(!pool.settled, 'Already settled');

        pool.settled = true;
        pool.winningOption = winningOption;

        emit PoolSettled(poolId, winningOption);
    }

    function claim(uint256 poolId) external {
        require(poolId < poolCount, 'Pool not found');

        Pool storage pool = _pools[poolId];
        BetInfo storage info = bets[poolId][msg.sender];

        require(pool.settled, 'Pool not settled');
        require(info.amount > 0, 'No bet found');
        require(!info.claimed, 'Already claimed');

        info.claimed = true;

        uint256 payout;
        if (info.option == pool.winningOption) {
            uint256 winningTotal = pool.winningOption == 0 ? pool.totalA : pool.totalB;
            uint256 totalPool = pool.totalA + pool.totalB;
            payout = (info.amount * totalPool) / winningTotal;
        } else {
            payout = 0;
        }

        if (payout > 0) {
            (bool success, ) = payable(msg.sender).call{value: payout}('');
            require(success, 'Transfer failed');
        }

        emit Claimed(poolId, msg.sender, payout);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), 'Invalid owner');
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
