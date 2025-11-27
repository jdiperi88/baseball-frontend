import React from "react";
import Coin from "./Coin";
import Wallet from "./Wallet";

function CoinsWalletWrapper({ coins, walletAmount }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "20px",
        paddingBottom: "20px",
      }}
    >
      <Coin coins={coins} />
      <Wallet amount={walletAmount} />
    </div>
  );
}

export default CoinsWalletWrapper;
