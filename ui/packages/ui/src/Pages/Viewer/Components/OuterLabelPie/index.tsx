import { Group } from "@visx/group";
import { Pie } from "@visx/shape";
import { useTooltip } from "@visx/tooltip";
import { OuterLabels } from "./OuterLabels";
import { RenderTooltip, TooltipData, useTooltipHandles } from "./Tooltip";


type Props<Datum> = {
  width: number;
  height: number;

  data: Datum[];
  pieValue: (d: Datum) => number;
  color: (d: Datum) => string;
  labelColor?: (d: Datum) => string;
  labelText: (d: Datum) => string;
  labelValue: (d: Datum) => string;

  tooltipContent?: (d: Datum) => string | JSX.Element;

  pieRadius?: number;
  labelRadius?: number;
  outline?: string;
  tail?: number;
}

export default <Datum,>(
    {
      width,
      height,
      data,
      color,
      labelColor = color,
      labelText,
      labelValue,
      pieValue,
      tooltipContent,
      pieRadius = 0.65,
      labelRadius = 0.8,
      outline = "#FFF",
      tail = 15
    }: Props<Datum>) => {
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip
  } = useTooltip<TooltipData<Datum>>();
  const tooltipHandles = useTooltipHandles(showTooltip, hideTooltip);

  const radius = Math.min(width, height) / 2;
  return (
    <>
      <svg width={width} height={height}>
        <Group left={width / 2} top={height / 2}>
          {/* label arcs */}
          <Pie
              data={data}
              pieValue={pieValue}
              innerRadius={radius * labelRadius}
              outerRadius={radius * labelRadius}>
            {(pie) => (
              <OuterLabels
                  arcs={pie.arcs}
                  labelRadius={radius * labelRadius}
                  pieRadius={radius * pieRadius}
                  labelColor={labelColor}
                  labelText={labelText}
                  labelValue={labelValue}
                  mouseHover={tooltipHandles.mouseHover}
                  mouseLeave={tooltipHandles.mouseLeave}
                  tail={tail} />
            )}
          </Pie>

          {/* tooltip hover arcs */}
          <Pie
              data={data}
              pieValue={pieValue}
              outerRadius={radius * pieRadius + (tail * 2 / 3)}>
            {(pie) => {
              return pie.arcs.map((arc, index) => {
                if (tooltipData?.index != index) {
                  return null;
                }

                return (
                  <path
                      key={"hover-arc-" + index}
                      d={pie.path(arc) ?? ""}
                      fill={color(arc.data)}
                      opacity={0.5}
                  />
                );
              });
            }}
          </Pie>

          {/* pie arcs */}
          <Pie
              data={data}
              pieValue={pieValue}
              outerRadius={radius * pieRadius}>
            {(pie) => {
              return pie.arcs.map((arc, index) => {
                return (
                  <path
                      key={"arc-" + index}
                      d={pie.path(arc) ?? ""}
                      fill={color(arc.data)}
                      stroke={outline}
                      strokeWidth={1}
                      onMouseMove={(e) => tooltipHandles.mouseHover(e, index, arc.data)}
                      onMouseLeave={() => tooltipHandles.mouseLeave()}
                  />
                );
              });
            }}
          </Pie>
        </Group>
      </svg>
      <RenderTooltip
          tooltipOpen={tooltipOpen}
          tooltipData={tooltipData}
          tooltipLeft={tooltipLeft}
          tooltipTop={tooltipTop}
          content={tooltipContent}
          handles={tooltipHandles}
          showTooltip={showTooltip}
      />
    </>
  );
};