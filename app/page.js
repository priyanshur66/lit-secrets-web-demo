"use client"
import React, { useState, useEffect } from "react";
import { LitNodeClient, decryptToString } from "@lit-protocol/lit-node-client";
import { LitNetwork, LIT_RPC } from "@lit-protocol/constants";
import * as ethers from "ethers";
import {
  createSiweMessage,
  generateAuthSig,
  LitAbility,
  LitActionResource
} from "@lit-protocol/auth-helpers";
import { Loader2 } from "lucide-react";

const DEFAULT_ENCRYPTED_DATA = undefined;

const RunLitActions = () => {
  const [encryptedDataString, setEncryptedDataString] = useState(JSON.stringify(DEFAULT_ENCRYPTED_DATA, null, 2));
  const [openAiPrompt, setOpenAiPrompt] = useState("");
  const [ethersWallet, setEthersWallet] = useState();
  const [litNodeClient, setLitNodeClient] = useState();
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const connectWallet = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      if (!window.ethereum) {
        throw new Error("Please install MetaMask to use this application");
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      const address = await signer.getAddress();

      setEthersWallet(signer);
      setWalletAddress(address);

      // Initialize Lit Node Client after wallet connection
      const litNodeClient = new LitNodeClient({
        litNetwork: LitNetwork.DatilDev,
        debug: false,
      });
      await litNodeClient.connect();
      setLitNodeClient(litNodeClient);
    } catch (err) {
      console.error("Wallet connection error:", err);
      setError(err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const runLitAction = async () => {
    try {
      setIsLoading(true);
      setError(null);

      let parsedEncryptedData;
      try {
        parsedEncryptedData = JSON.parse(encryptedDataString);
      } catch (e) {
        throw new Error("Invalid JSON format for encrypted data");
      }

      const sessionSignatures = await litNodeClient.getSessionSigs({
        chain: "baseSepolia",
        expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
        resourceAbilityRequests: [
          {
            resource: new LitActionResource("*"),
            ability: LitAbility.LitActionExecution,
          },
        ],
        authNeededCallback: async ({ uri, expiration, resourceAbilityRequests }) => {
          const toSign = await createSiweMessage({
            uri,
            expiration,
            resources: resourceAbilityRequests,
            walletAddress: await ethersWallet.getAddress(),
            nonce: await litNodeClient.getLatestBlockhash(),
            litNodeClient,
          });

          return await generateAuthSig({
            signer: ethersWallet,
            toSign,
          });
        },
      });

      const accessControlConditions = [
        {
          contractAddress: "ipfs://QmVhccY3ucrAsNx1LfGSMrYrBukDGKHgLtuCqygUzfTdTk",
          standardContractType: "LitAction",
          chain: "ethereum",
          method: "checkVal",
          parameters: ["QmQ5wSTVTrQEqpLyAuPE67KRJCSq4oLty2ahTQrRGXVUZf"],
          returnValueTest: {
            comparator: "=",
            value: "true",
          },
        },
      ];

      const result = await litNodeClient.executeJs({
        sessionSigs: sessionSignatures,
        ipfsId: 'QmQ5wSTVTrQEqpLyAuPE67KRJCSq4oLty2ahTQrRGXVUZf',
        jsParams: {
          accessControlConditions,
          ciphertext: parsedEncryptedData.encryptedData,
          dataToEncryptHash: parsedEncryptedData.dataToEncryptHash,
          openAiPrompt,
        },
      });
      console.log(result);

      setResponse(result.response);
    } catch (error) {
      console.error("Error running Lit Action:", error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="bg-orange-600 px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Lit Secrets Web Demo</h1>
          {!walletAddress ? (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="bg-white text-orange-600 px-4 py-2 rounded-lg font-medium hover:bg-orange-50 transition-colors duration-200"
            >
              {isConnecting ? (
                <span className="flex items-center">
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Connecting...
                </span>
              ) : (
                "Connect Wallet"
              )}
            </button>
          ) : (
            <div className="text-white font-medium">
              {`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}
            </div>
          )}
        </div>

        {walletAddress ? (
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Paste Secret Object
                </label>
                <textarea
                  value={encryptedDataString}
                  onChange={(e) => setEncryptedDataString(e.target.value)}
                  className="w-full p-3 border border-orange-200 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none font-mono text-gray-900 bg-orange-50"
                  placeholder="Enter Lit Secrets object.."
                  rows="6"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  OpenAI Prompt
                </label>
                <textarea
                  value={openAiPrompt}
                  onChange={(e) => setOpenAiPrompt(e.target.value)}
                  className="w-full p-3 border border-orange-200 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-gray-900"
                  placeholder="This prompt will be processed through the encrypted api key in your lit secret"
                  rows="3"
                />
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}

              <button
                onClick={runLitAction}
                disabled={isLoading}
                className={`w-full bg-orange-600 hover:bg-orange-700 text-white py-3 px-4 rounded transition-colors duration-200 font-medium ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="animate-spin mr-2 h-5 w-5" />
                    Processing...
                  </span>
                ) : (
                  "Run Lit Action"
                )}
              </button>

              {response && (
                <div className="mt-6 p-4 bg-orange-50 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Response:</h3>
                  <p className="text-gray-900 bg-white p-4 rounded border border-orange-200">
                    {response}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-gray-600">
            Please connect your wallet to access the application.
          </div>
        )}
      </div>
    </div>
  );
};

export default RunLitActions;