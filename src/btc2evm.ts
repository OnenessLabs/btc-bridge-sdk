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


//{
//  const _useNetwork: string = "Q_TESTNET"; //"Q", "Q_TESTNET", "POLYGON", "POLYGON_TESTNET" or "LINEA_TESTNET"
//const _useToken: string = EVMChains[_useNetwork].tokens.USDC; //Token to swap from
//const _amount: BN = new BN(10000); //Amount of satoshis to receive (1 BTC = 100 000 000 satoshis)
//
////Create the swap: swapping _amount of satoshis of Bitcoin on-chain to _useToken
//const swap: FromBTCSwap<EVMSwapData> = await swapper.createBTCtoEVMSwap(_useToken, _amount);
//
////Get the amount required to pay, amount to be received and fee
//const amountToBePaidOnBitcoin: BN = swap.getInAmount(); //The amount to be received on bitcoin on-chain address, the amount MUST match! In satoshis (no decimals)
//const amountToBeReceivedOnEVM: BN = swap.getOutAmount(); //Get the amount we will receive on EVM (excluding fee), in base units (no decimals)
//const fee: BN = swap.getFee(); //Swap fee paid in the ERC-20/ETH token on EVM, in base units (no decimals)
//
////Get swap offer expiration time
//const expiry: number = swap.getExpiry(); //Expiration time of the swap offer in UNIX milliseconds, swap needs to be initiated before this time
//
////Get security deposit amount (amount of ETH that needs to be put down to rent the liquidity from swap intermediary), you will get this deposit back if you successfully conclude the swap
//const securityDeposit: BN = swap.getSecurityDeposit();
////Get claimer bounty (amount of ETH reserved as a reward for watchtowers to claim the swap on your behalf in case you go offline)
//const claimerBounty: BN = swap.getClaimerBounty();
//
////Once client is happy with swap offer
//await swap.commit();
//
////Get the bitcoin address and amount required to be sent to that bitcoin address
//const receivingAddressOnBitcoin = swap.getAddress();
////Get the QR code (contains the address and amount)
//const qrCodeData = swap.getQrData(); //Data that can be displayed in the form of QR code
////Get the timeout (in UNIX millis), the transaction should be made in under this timestamp, and with high enough fee for the transaction to confirm quickly
//const expiryTime = swap.getTimeoutTime();
//
//try {
//    //Wait for the payment to arrive
//    await swap.waitForPayment(null, null, (txId: string, confirmations: number, targetConfirmations: number) => {
//        //Updates about the swap state, txId, current confirmations of the transaction, required target confirmations
//    });
//    //Claim the swap funds
//    await swap.claim();
//} catch(e) {
//    //Error occurred while waiting for payment
//}
//}

main().catch((e) => console.error(e));
