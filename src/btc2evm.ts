import * as BN from 'bn.js';
import { BitcoinNetwork } from './BitcoinNetwork';
import { EVMChains } from './EVMChains';
import { createNodeJSSwapperOptions } from './NodeJSSwapperOptions';
import * as ethers from 'ethers';
import { EVMSwapper } from './EVMSwapper';
import { EVMSwapData } from 'evmlightning-sdk';
// import { ToBTCSwap } from 'crosslightning-sdk-base';

const rpcUrl = 'https://rpc.devnet.onenesslabs.io';
const privateKey =
  '';
//Set swapper options
const _network = 'ONE_TESTNET'; //"Q", "Q_TESTNET", "POLYGON", "POLYGON_TESTNET" or "LINEA_TESTNET"
const _intermediaryUrl = 'http://localhost:4000'; //URL of the desired swap intermediary

async function main() {
  //Defines max swap price difference to the current market price as fetched from CoinGecko API tolerance in PPM (1000000 = 100%)
  const _swapDifferenceTolerance = new BN(2500); //Max allowed difference 0.25%

  //For browser like environment (using browser local storage)
  // const _options = createSwapperOptions(_network, _swapDifferenceTolerance, _intermediaryUrl);
  //For NodeJS environment (using filesystem storage)
  const _options = createNodeJSSwapperOptions(
    _network,
    _swapDifferenceTolerance,
    _intermediaryUrl
  ); //import from "evmlightning-sdk/dist/NodeJSSwapperOptions"
  console.log("swapper options", _options)

  //Create the swapper instance

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider); //Or ethers.Wallet.createRandom() to generate new one
  //   signer.connect(provider);
  const swapper = new EVMSwapper(signer, _options);
  //Initialize the swapper
  await swapper.init();

  const _useNetwork: string = 'ONE_TESTNET'; //"Q", "Q_TESTNET", "POLYGON", "POLYGON_TESTNET" or "LINEA_TESTNET"
  const _useToken: string = EVMChains[_useNetwork].tokens.USDC; //Token to swap from
  const _address: string = 'tb1q75mc4s67y4ccq3vg8czefepnmq2uv0zyp79khf'; //Destination bitcoin address
  const _amount: BN = new BN(1); //Amount of satoshis to send (1 BTC = 100 000 000 satoshis)

  //Create the swap: swapping _useToken to Bitcoin on-chain, sending _amount of satoshis (smallest unit of bitcoin) to _address
  let swap = await swapper.createEVMToBTCSwap(_useToken, _address, _amount);
  // let swap = await swapper.createEVMToBTCSwapExactIn(_useToken,_address, _amount)

  //Get the amount required to pay and fee
  const amountToBePaid: BN = swap.getInAmount(); //Amount to be paid in the ERC-20/ETH token on EVM (including fee), in base units (no decimals)
  const fee: BN = swap.getFee(); //Swap fee paid in the ERC-20/ETH token on EVM (already included in the getInAmount()), in base units (no decimals)

  //Get swap expiration time
  const expiry: number = swap.getExpiry(); //Expiration time of the swap in UNIX milliseconds, swap needs to be initiated before this time


  console.log(`swap data ${amountToBePaid}, fee:${fee}, expire:${expiry}`)

  //Check if ERC-20 approval is required
  const isApprovalRequired: boolean = await swapper.isApproveRequired(swap);

  console.log("is approved", isApprovalRequired)

  //Approve the spending of ERC-20 token by contract
  if (isApprovalRequired) {
    await swapper.approveSpend(swap);
  }

  //Initiate and pay for the swap
  await swap.commit();


  console.log("commit tx...")

  //Wait for the swap to conclude
  const result: boolean = await swap.waitForPayment();
  if (!result) {
    //Swap failed, money can be refunded
    await swap.refund();
  } else {
    //Swap successful
  }
}

main().catch((e) => console.error(e));
