export interface LaneConfig {
  id: string;
  title: string;
  x: number;
  width: number;
}

export const DEFAULT_LANES: Omit<LaneConfig, 'x'>[] = [
  { id: 'lane-1', title: 'Nguồn phát hiện đầu tiên', width: 320 },
  { id: 'lane-2', title: 'Nhân sự vận hành liên lạc (VOC)', width: 360 },
  { id: 'lane-3', title: 'Trưởng điều phối khán giả (VOC)', width: 360 },
  { id: 'lane-4', title: 'Nhân viên hiện trường', width: 400 },
];

export const LANE_LEFT_PADDING = 40;
export const LANE_TOP = 30;
export const LANE_HEIGHT = 1100;
export const LANE_Y = LANE_TOP + LANE_HEIGHT / 2;

export function withPositions(
  lanes: Omit<LaneConfig, 'x'>[],
  leftPadding = LANE_LEFT_PADDING,
): LaneConfig[] {
  let cursor = leftPadding;
  return lanes.map((lane) => {
    const x = cursor + lane.width / 2;
    cursor += lane.width;
    return { ...lane, x };
  });
}

export const LANES: LaneConfig[] = withPositions(DEFAULT_LANES);
