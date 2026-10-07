import CatechismScreen from "../../src/features/catechism/catechism-screen";
import { Redirect } from "expo-router";
import ConfessionScreen from "../../src/features/catechism/confession-screen";
import { useTraditionStore } from "../../src/features/settings/tradition-store";

export default function CatechismTab() {
  const tradition = useTraditionStore(state => state.tradition);
  if (tradition === "exploring") return <Redirect href="/" />;
  return tradition === "protestant" ? <ConfessionScreen /> : <CatechismScreen />;
}
