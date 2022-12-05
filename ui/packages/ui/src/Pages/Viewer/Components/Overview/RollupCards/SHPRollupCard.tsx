import { SimResults } from "@gcsim/types";
import { useTranslation } from "react-i18next";
import { RollupCard } from "./Template";

export default ({ data, color }: { data: SimResults | null; color: string }) => {
  const { i18n } = useTranslation();
  const fmt = (val?: number) => val?.toLocaleString(i18n.language, { maximumFractionDigits: 0 });
  const shp = data?.statistics?.shp;

  return (
    <RollupCard
        key="shp"
        color={color}
        title="Effective Shield HP (SHP)"
        value={fmt(shp?.mean)}
        auxStats={[
          { title: "min", value: fmt(shp?.min) },
          { title: "max", value: fmt(shp?.max) },
          { title: "std", value: fmt(shp?.sd) },
          { title: "p25", value: fmt(shp?.q1) },
          { title: "p50", value: fmt(shp?.q2) },
          { title: "p75", value: fmt(shp?.q3) },
        ]}
        tooltip="help"
        hashLink="shields" />
  );
};