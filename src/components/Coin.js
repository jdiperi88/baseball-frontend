import React, { useState, useEffect, useRef } from "react";

function Coin({ coins }) {
  return (
    <div
      style={{
        width: "50px",
        height: "50px",
        borderRadius: "50%",
        backgroundColor: "#FFD700", // gold color for the coin
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "1.5rem",
        marginBottom: "10px",
      }}
    >
      {coins}
    </div>
  );
}

export default Coin;
