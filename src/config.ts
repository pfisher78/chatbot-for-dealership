import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

export interface RepresentativeExample {
  description: string;
  cashPriceGbp: number;
  depositGbp: number;
  amountOfCreditGbp: number;
  termMonths: number;
  monthlyPaymentGbp: number;
  optionToPurchaseFeeGbp?: number;
  totalAmountPayableGbp: number;
  aprRepresentativePercent: number;
  fixedInterestRatePerAnnumPercent?: number;
}

export interface DealershipConfig {
  dealership: {
    name: string;
    tagline: string;
    brands: string[];
    address: string;
    phone: string;
    email: string;
    website: string;
    companyNumber?: string;
    vatNumber?: string;
    hours: {
      sales: Record<string, string>;
      service: Record<string, string>;
    };
    pricing: {
      vatIncluded: boolean;
      adminFeeGbp: number;
      adminFeeNote: string;
    };
    financing: {
      // "representative_example": the bot may present the dealer-approved
      // representative example below (FCA CONC-compliant framing).
      // "disabled": the bot never discusses figures; finance questions are
      // referred to the dealership's finance team.
      mode: "representative_example" | "disabled";
      // Must be explicitly set true by the dealer principal to confirm the
      // representative example and disclosure text have been signed off.
      // If false, the finance tool behaves as disabled regardless of mode.
      approvedByDealer: boolean;
      fcaDisclosure: string;
      representativeExample?: RepresentativeExample;
    };
    specialOffers: { title: string; details: string; expires: string }[];
  };
  branding: {
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    fontFamily: string;
    logoUrl: string;
    botName: string;
    botAvatar: string;
    widgetPosition: string;
    greeting: string;
  };
  behavior: {
    leadCaptureMode: string;
    afterHoursMessage: string;
    handoffPhone: string;
    languages: string[];
  };
}

const configPath = path.resolve(
  process.env.DEALERSHIP_CONFIG || "./config/dealership.config.json"
);

export const dealershipConfig: DealershipConfig = JSON.parse(
  fs.readFileSync(configPath, "utf-8")
);

// Finance conversation is only enabled when the dealer has explicitly signed
// off on the representative example and disclosure text (FCA compliance).
export const financeEnabled: boolean =
  dealershipConfig.dealership.financing.mode === "representative_example" &&
  dealershipConfig.dealership.financing.approvedByDealer === true &&
  dealershipConfig.dealership.financing.representativeExample != null &&
  dealershipConfig.dealership.financing.fcaDisclosure.trim().length > 0;

if (dealershipConfig.dealership.financing.mode === "representative_example" && !financeEnabled) {
  console.warn(
    "[config] financing.mode is 'representative_example' but approvedByDealer is not true " +
      "(or the representative example / FCA disclosure is missing). " +
      "Finance discussion is DISABLED until the dealer signs off."
  );
}

export const env = {
  port: parseInt(process.env.PORT || "3000", 10),
  model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
  adminToken: process.env.ADMIN_TOKEN || "change-me",
};
