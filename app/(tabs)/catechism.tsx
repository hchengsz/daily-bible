import CatechismScreen from "../../src/features/catechism/catechism-screen";
import ConfessionScreen from "../../src/features/catechism/confession-screen";
import { useTraditionStore } from "../../src/features/settings/tradition-store";

export default function CatechismTab() {
  const tradition = useTraditionStore(state => state.tradition);
  return tradition === "protestant" ? <ConfessionScreen /> : <CatechismScreen />;
}
