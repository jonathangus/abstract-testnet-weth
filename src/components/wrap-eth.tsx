import { useCallback, useEffect, useState } from 'react';
import { useWriteContractSponsored } from '@abstract-foundation/agw-react';
import { parseAbi } from 'viem';
import { useAccount, useBalance, useBlockNumber } from 'wagmi';
import { getGeneralPaymasterInput } from 'viem/zksync';

const WETH_ADDRESS = '0x9EDCde0257F2386Ce177C3a7FCdd97787F0D841d';
const PAYMASTER_ADDRESS = '0x5407B5040dec3D339A9247f3654E59EEccbb6391';

function parseToWei(amount: string): bigint {
  try {
    // Convert amount to wei (multiply by 10^18)
    const [whole, decimal = ''] = amount.split('.');
    const decimals = decimal.padEnd(18, '0').slice(0, 18);
    return BigInt(whole + decimals);
  } catch {
    return BigInt(0);
  }
}

export function WrapWeth() {
  const [amount, setAmount] = useState('');
  const [isWrapMode, setIsWrapMode] = useState(true);
  const { writeContractSponsored, isSuccess, isPending, error } =
    useWriteContractSponsored();
  const { address } = useAccount();
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const { data: balance, refetch: refetchBalance } = useBalance({
    address,
  });
  const { data: balanceWeth, refetch: refetchBalanceWeth } = useBalance({
    address,
    token: WETH_ADDRESS,
  });
  const [amountIsOk, setAmountIsOk] = useState(false);

  useEffect(() => {
    setAmount('');
  }, [isSuccess]);

  useEffect(() => {
    refetchBalance();
    refetchBalanceWeth();
  }, [blockNumber, refetchBalance, refetchBalanceWeth]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isWrapMode) {
      handleWrap();
    } else {
      handleUnwrap();
    }
  }

  const isAmountValid = useCallback(() => {
    const amountWei = parseToWei(amount);
    let maxWei;
    if (isWrapMode) {
      maxWei = balance?.value || BigInt(0);
    } else {
      maxWei = balanceWeth?.value || BigInt(0);
    }

    return amountWei > 0 && amountWei <= maxWei;
  }, [amount, isWrapMode, balance?.value, balanceWeth?.value]);

  const currentBalance = isWrapMode
    ? balance?.formatted
    : balanceWeth?.formatted;
  useEffect(() => {
    setAmountIsOk(isAmountValid());
  }, [amount, isAmountValid]);

  const handleUnwrap = () => {
    if (!isAmountValid()) return;
    writeContractSponsored({
      abi: parseAbi(['function withdraw(uint wad) public']),
      address: WETH_ADDRESS,
      functionName: 'withdraw',
      args: [parseToWei(amount)],
      paymaster: PAYMASTER_ADDRESS,
      paymasterInput: getGeneralPaymasterInput({
        innerInput: '0x',
      }),
    });
  };

  const handleWrap = () => {
    if (!isAmountValid()) return;

    writeContractSponsored({
      abi: parseAbi(['function deposit() public payable']),
      address: WETH_ADDRESS,
      functionName: 'deposit',
      value: parseToWei(amount),
      paymaster: PAYMASTER_ADDRESS,
      paymasterInput: getGeneralPaymasterInput({
        innerInput: '0x',
      }),
    });
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-sm text-gray-400">
        Balance ETH: {balance?.formatted || '0'}
      </div>

      <div className="text-sm text-gray-400">
        Balance WETH: {balanceWeth?.formatted || '0'}
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full flex flex-col items-center gap-4"
      >
        <div className="relative w-full max-w-xs">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="w-60 border p-2 rounded text-black pr-16"
            step="0.000001"
            min="0"
            max={currentBalance || '0'}
          />
          <button
            type="button"
            onClick={() =>
              setAmount(
                isWrapMode
                  ? balance?.formatted || '0'
                  : balanceWeth?.formatted || '0'
              )
            }
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300 text-gray-700"
          >
            Max
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm">{isWrapMode ? 'Wrap' : 'Unwrap'}</span>
          <button
            type="button"
            onClick={() => setIsWrapMode(!isWrapMode)}
            className={`w-12 h-6 flex items-center bg-gray-300 rounded-full p-1 transition-colors ${
              isWrapMode ? 'bg-green-400' : 'bg-red-400'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                isWrapMode ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <button
          type="submit"
          disabled={isPending || !amount || !amountIsOk}
          className={`rounded-full border border-solid transition-colors flex items-center justify-center text-white gap-2 text-sm h-10 px-5
            ${
              isPending || !amount || !amountIsOk
                ? 'bg-gray-500 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-r from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 border-transparent'
            }`}
        >
          {isPending
            ? isWrapMode
              ? 'Wrapping...'
              : 'Unwrapping...'
            : isWrapMode
            ? 'Wrap WETH'
            : 'Unwrap WETH'}
        </button>

        {error && (
          <div className="text-red-500 text-sm mt-2">
            Error: {error.message || 'An error occurred'}
          </div>
        )}
      </form>
    </div>
  );
}
