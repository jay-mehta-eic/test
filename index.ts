import express, { Application, Request, Response } from 'express';
import * as dotenv from 'dotenv';
import * as algosdk from 'algosdk';
import pinataSdk from '@pinata/sdk';
import cors from 'cors';
import axios, { AxiosResponse } from 'axios';

const pinata = new pinataSdk(process.env.PINATA_KEY, process.env.PINATA_SECRET_KEY);

dotenv.config();

const algodServer = process.env.ALGOD_URL as string;
const algodPort = process.env.ALGOD_PORT as string;

const algodClient = new algosdk.Algodv2("", algodServer, algodPort);
const app: Application = express();

app.use(cors());
app.use(express.json());

app.post('/create-wallet', async (req: Request, res: Response) => {
    const account = await createWallet();
    console.log("my account================", account)
    res.json(account);
});

app.post('/create-nft', async (req: Request, res: Response) => {

    const pinData = await pinDataToPinata(req.body.formData);
    const nft = await createNFT(req.body.addr, pinData.IpfsHash,req.body.sk);

    if (nft.status === true) {
        return res.json(nft.tx_url);
    }
})

app.listen(process.env.PORT, () => {
    console.log("Server listening on port: ", process.env.PORT);
});

const createWallet = async () => {
    const account = algosdk.generateAccount();
    const isAccountFunded = await fundAccount(account.addr);
    return isAccountFunded ? account : false;
}

const fundAccount = async (receiver: string): Promise<boolean> => {
    const account = algosdk.mnemonicToSecretKey(process.env.MASTER_PRIVATE as string);
    console.log("master account========", account);

    const suggestedParams = await algodClient.getTransactionParams().do();

    const xferTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: account.addr,
        to: receiver,
        suggestedParams,
        amount: 5000000
    });

    const signedXferTxn = xferTxn.signTxn(account.sk);

    try {
        await algodClient.sendRawTransaction(signedXferTxn).do();

        const result = await algosdk.waitForConfirmation(algodClient, xferTxn.txID().toString(), 3);

        return true;
    } catch (error) {
        return false;
    }
}

const createNFT = async (addres: string, pinataUrl: string, sk: Uint8Array) => {
    const suggestedParams = await algodClient.getTransactionParams().do();

    const asset_name = "ALGO-MOON";
    const unit_name = "MOONS";

    const nft_txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
        from: addres,
        suggestedParams,
        defaultFrozen: false,
        unitName: unit_name,
        assetName: asset_name,
        manager: addres,
        reserve: addres,
        freeze: addres,
        clawback: addres,
        assetURL: pinataUrl,
        total: 1,
        decimals: 0,
    });

    console.log("NFT txn", nft_txn);

    const signed_nft_txn = nft_txn.signTxn(sk);

    try {
        await algodClient.sendRawTransaction(signed_nft_txn).do();

        const result = await algosdk.waitForConfirmation(algodClient, nft_txn.txID().toString(), 3);
        console.log("Result NFT  create", result);

        const confirmRound = result['confirm-round'];

        return {
            status: true,
            msg: `Transaction Successful in Round ${confirmRound}`,
            tx_url: `https://testnet.explorer.perawallet.app/tx/${nft_txn.txID()}`
        }
    } catch (error: any) {
        return { status: false, msg: error.message };
    }
}

const pinDataToPinata = async (data: any): Promise<any> => {
    const payload = {
        pinataContent: data,
    };

    const headers = {
        "Content-Type": "application/json",
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI5NzdjNDljZi05OGViLTQ5MzYtYjhkNC1lNzQ2OGJhZGY3NzkiLCJlbWFpbCI6ImpheS5qYm05NEBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJpZCI6IkZSQTEiLCJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MX0seyJpZCI6Ik5ZQzEiLCJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MX1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiYTJjNzNiMTllMzdjYTQ5ZDQ2ZjIiLCJzY29wZWRLZXlTZWNyZXQiOiJiNWE5Zjk2MDU2NDE1Y2YxZmVjOGY1OTIzYzJmYWUyZDFjZmQ2YjcyNTY4MTEzY2MxNDJlODE5ZTE0ZDdhMDVkIiwiaWF0IjoxNzIxMjIyMjM3fQ.5Pld-Lh7REVjEabagAS5Msp1bjowbsiI93-ACnTo-Ek`
    }

    try {
        const response: AxiosResponse = await axios.post(process.env.PINATA_API as string, payload, {
            headers
        });
    
        return response.data; 
    } catch (error) {
        console.log("error happended",error)
    }
    
}
