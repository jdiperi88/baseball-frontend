import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Button,
  CardMedia,
} from "@mui/material";
import loadImage from "../util";
import RuleRequirements from "./RuleRequirements";

function RewardCard({ reward, coins, onRedeem, ruleStatus }) {
  const enoughCoins = coins >= reward.cost;
  const isRedeemable = enoughCoins && (!ruleStatus || ruleStatus.canRedeem);

  // Format rule reasons
  const rulesMet = ruleStatus?.rulesMet || [];
  const rulesNotMet = ruleStatus?.rulesNotMet || [];
  const hasRules = rulesMet.length > 0 || rulesNotMet.length > 0;

  return (
    <Card
      style={{
        maxWidth: "500px",
        marginBottom: "1rem",
        backgroundColor: isRedeemable ? "white" : "#E0E0E0",
        margin: "0 auto",
      }}
    >
      {reward.image_path && (
        <CardMedia
          component="img"
          alt={reward.name}
          image={loadImage(reward.image_path)}
          style={{
            width: "100%",
            maxHeight: "281px",
            objectFit: "cover",
          }}
        />
      )}
      <CardContent>
        <Typography variant="h6">
          {reward.name} - {reward.cost} coins
        </Typography>

        {hasRules && (
          <RuleRequirements rulesMet={rulesMet} rulesNotMet={rulesNotMet} />
        )}

        <Button
          variant="contained"
          color="primary"
          disabled={!isRedeemable}
          onClick={onRedeem}
          sx={{ mt: 1 }}
        >
          Redeem
        </Button>
      </CardContent>
    </Card>
  );
}

export default RewardCard;
