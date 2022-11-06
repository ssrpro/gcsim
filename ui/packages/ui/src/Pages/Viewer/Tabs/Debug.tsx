import {
  Button,
  ButtonGroup,
  HTMLSelect,
  Intent,
  NonIdealState,
  OptionProps,
  Spinner,
  SpinnerSize,
} from "@blueprintjs/core";
import { LogDetails, Sample, SimResults } from "@gcsim/types";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AdvancedPreset,
  AllDebugOptions,
  DebugPreset,
  DefaultDebugOptions,
  SimplePreset,
  VerbosePreset,
  Debugger,
  Options,
  DebugRow,
  parseLogV2,
} from "../Components/Debug";

const SAVED_DEBUG_KEY = "gcsim-debug-settings";

type UseDebugData = {
  logs?: LogDetails[];
  parsed: DebugRow[] | null;
  seed: string | null;
  settings: string[];
  generating: boolean;
  setGenerating: (val: boolean) => void;
  setLogs: (debug?: LogDetails[]) => void;
  setSettings: (val: string[]) => void;
  setSeed: (val: string | null) => void;
};

type Props = {
  simDebugger: (cfg: string, seed: string) => Promise<Sample>
  data: SimResults | null;
  debug: UseDebugData;
  running: boolean;
};

// TODO: translation
// TODO: The debugger should be refactored. This is a mess of passing around info
export default ({ simDebugger, data, debug, running }: Props) => {
  if (data?.character_details == null || data?.config_file == null || debug.generating) {
    return <NonIdealState icon={<Spinner size={SpinnerSize.LARGE} />} />;
  }

  if (debug.parsed == null) {
    return (
      <NonIdealState
        icon="helper-management"
        action={<Generate simDebugger={simDebugger} data={data} debug={debug} running={running} />}
      />
    );
  }

  const names = data.character_details.map((c) => c.name);
  return (
    <div className="flex flex-grow flex-col h-full gap-2 px-4">
      <Generate simDebugger={simDebugger} data={data} debug={debug} running={running} />
      <Debugger data={debug.parsed} team={names} searchable={{}} />
      <DebugOptions settings={debug.settings} setSettings={debug.setSettings} />
    </div>
  );
};

const Generate = ({
      simDebugger,
      data,
      debug,
      running,
    }: {
      simDebugger: (cfg: string, seed: string) => Promise<Sample>,
      data: SimResults;
      debug: UseDebugData;
      running: boolean;
    }) => {
  let startValue = "sample";
  switch (debug.seed) {
    case null:
      startValue = "sample";
      break;
    case data.sample_seed:
      startValue = "sample";
      break;
    case data.statistics?.min_seed:
      startValue = "min";
      break;
    case data.statistics?.max_seed:
      startValue = "max";
      break;
    case data.statistics?.p25_seed:
      startValue = "q1";
      break;
    case data.statistics?.p50_seed:
      startValue = "q2";
      break;
    case data.statistics?.p75_seed:
      startValue = "q3";
      break;
  }
  const [value, setValue] = useState(startValue);
  const options: OptionProps[] = [
    { label: "Sample Seed", value: "sample" },
    // { label: "Random", value: "rand" },
    { label: "Min Seed", value: "min" },
    { label: "Max Seed", value: "max" },
    { label: "P25 Seed", value: "q1" },
    { label: "P50 Seed", value: "q2" },
    { label: "P75 Seed", value: "q3" },
  ];

  const disabled = () => {
    return running && ["min", "max", "q1", "q2", "q3"].includes(value);
  };

  const click = () => {
    let seed = "0";
    switch (value) {
      case "sample":
        seed = data.sample_seed ?? seed;
        break;
      case "rand":
        seed = "" + Math.floor(Number.MAX_SAFE_INTEGER * Math.random());
        break;
      case "min":
        seed = data.statistics?.min_seed ?? seed;
        break;
      case "max":
        seed = data.statistics?.max_seed ?? seed;
        break;
      case "q1":
        seed = data.statistics?.p25_seed ?? seed;
        break;
      case "q2":
        seed = data.statistics?.p50_seed ?? seed;
        break;
      case "q3":
        seed = data.statistics?.p75_seed ?? seed;
        break;
    }

    debug.setGenerating(true);
    debug.setSeed(seed);
    simDebugger(data.config_file ?? "", seed).then((out) => {
      console.log(out);
      debug.setLogs(out.logs);
      debug.setGenerating(false);
    });
  };

  return (
    <>
      <HTMLSelect
        options={options}
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
      />
      <Button
        large={true}
        text="Generate"
        icon="refresh"
        intent={Intent.PRIMARY}
        disabled={disabled()}
        onClick={click}
      />
    </>
  );
};

const DebugOptions = ({
  settings,
  setSettings,
}: {
  settings: string[];
  setSettings: (val: string[]) => void;
}) => {
  const { t } = useTranslation();
  const [isOpen, setOpen] = useState(false);

  const toggle = (t: string) => {
    const i = settings.indexOf(t);
    const next = [...settings];
    if (i === -1) {
      next.push(t);
    } else {
      next.splice(i, 1);
    }
    setSettings(next);
  };

  const presets = (opt: "simple" | "advanced" | "verbose" | "debug") => {
    switch (opt) {
      case "simple":
        setSettings(SimplePreset);
        return;
      case "advanced":
        setSettings(AdvancedPreset);
        return;
      case "verbose":
        setSettings(VerbosePreset);
        return;
      case "debug":
        setSettings(DebugPreset);
        return;
    }
  };

  return (
    <div className="w-full p-2 pb-0">
      <ButtonGroup fill>
        <Button
          onClick={() => setOpen(true)}
          icon="cog"
          intent="primary"
          text={t<string>("viewer.sample_settings")}
        />
      </ButtonGroup>
      <Options
        isOpen={isOpen}
        handleClose={() => setOpen(false)}
        handleClear={() => setSettings([])}
        handleResetDefault={() => setSettings(DefaultDebugOptions)}
        handleToggle={toggle}
        handleSetPresets={presets}
        selected={settings}
        options={AllDebugOptions}
      />
    </div>
  );
};

export function useDebug(running: boolean, data: SimResults | null): UseDebugData {
  const [selected, setSelected] = useState<string[]>(() => {
    const saved = localStorage.getItem(SAVED_DEBUG_KEY);
    if (saved) {
      const initialValue = JSON.parse(saved);
      return initialValue || DefaultDebugOptions;
    }
    return DefaultDebugOptions;
  });

  const setAndStore = (val: string[]) => {
    setSelected(val);
    localStorage.setItem(SAVED_DEBUG_KEY, JSON.stringify(val));
  };

  const [debug, setDebug] = useState<LogDetails[] | undefined>(undefined);
  const [generating, setGenerating] = useState(false);
  const [seed, setSeed] = useState<string | null>(null);

  // Special case where sim is rerunning. Want to reset any generated debug state
  useEffect(() => {
    if (running) {
      setDebug(undefined);
    }
  }, [running]);

  const parsed = useMemo(() => {
    if (data?.initial_character == null || data.character_details == null) {
      return null;
    }

    if (debug == null) {
      return null;
    }

    return parseLogV2(
        data.initial_character,
        data?.character_details?.map((c) => c.name),
        debug,
        selected);
  }, [debug, data?.initial_character, data?.character_details, selected]);

  return {
    logs: debug,
    parsed: parsed,
    seed: seed,
    settings: selected,
    generating: generating,
    setGenerating: setGenerating,
    setLogs: setDebug,
    setSettings: setAndStore,
    setSeed: setSeed,
  };
}