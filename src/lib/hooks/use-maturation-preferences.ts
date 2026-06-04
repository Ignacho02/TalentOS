import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import type { MaturationEngine } from "@/lib/maturation/unified-maturation";

export type BioBandingStrategy = "offset" | "pah";

const MATURATION_ENGINE_KEY = "maturation_selected_engine";
const MATURATION_BIOBANDING_STRATEGY_KEY = "maturation_bio_banding_strategy";

const DEFAULT_ENGINE: MaturationEngine = "auto";
const DEFAULT_BIOBANDING_STRATEGY: BioBandingStrategy = "offset";

export function useMaturationPreferences() {
  const [selectedEngine, setSelectedEngine] = usePersistentState<MaturationEngine>(
    MATURATION_ENGINE_KEY,
    DEFAULT_ENGINE,
    "local",
  );

  const [bioBandingStrategy, setBioBandingStrategy] = usePersistentState<BioBandingStrategy>(
    MATURATION_BIOBANDING_STRATEGY_KEY,
    DEFAULT_BIOBANDING_STRATEGY,
    "local",
  );

  return {
    selectedEngine,
    setSelectedEngine,
    bioBandingStrategy,
    setBioBandingStrategy,
  };
}
