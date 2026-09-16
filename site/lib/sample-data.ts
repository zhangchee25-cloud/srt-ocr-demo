export type SampleRegion = {
  id: string;
  order: number;
  text: string;
  bbox: [number, number, number, number];
};

export const sampleRegions: SampleRegion[] = [
  { id: "line-01", order: 1, text: "須菩提如恒河中所有沙數如是沙等恒河", bbox: [0.70066536, 0.15133057, 0.78713997, 0.83647461] },
  { id: "line-02", order: 2, text: "於意云何是諸恒河沙寧為多不須菩提言", bbox: [0.618625, 0.14911328, 0.70362174, 0.83536572] },
  { id: "line-03", order: 3, text: "甚多世尊但諸恒河尚多无數何況其沙須", bbox: [0.54397656, 0.14855859, 0.62601628, 0.8381377] },
  { id: "line-04", order: 4, text: "菩提我今實言告汝若有善男子善女人以", bbox: [0.47154492, 0.15077588, 0.5594974, 0.83259424] },
  { id: "line-05", order: 5, text: "七寶滿尔所恒河沙數三千大千世界以用", bbox: [0.3983737, 0.15188477, 0.48189193, 0.81873633] },
  { id: "line-06", order: 6, text: "布施得福多不須菩提言甚多世尊佛告須", bbox: [0.31263867, 0.15133057, 0.40354753, 0.8248335] },
  { id: "line-07", order: 7, text: "菩提若有善男子善女人於此中乃至受", bbox: [0.24316341, 0.15133057, 0.33037695, 0.83481152] },
  { id: "line-08", order: 8, text: "持四句偈等為他人說而此福德勝前福德", bbox: [0.16777539, 0.14911328, 0.24685872, 0.83481152] },
  { id: "line-09", order: 9, text: "復次須菩提随說是經乃至四句偈等當知", bbox: [0.08499609, 0.1474502, 0.17368815, 0.82815967] },
  { id: "line-10", order: 10, text: "此處一切世間天人阿修羅皆應供養如佛", bbox: [0.00665169, 0.14135254, 0.0931263, 0.82594238] },
];

export const sampleFullText = sampleRegions.map((region) => region.text).join("\n");

export const sampleMeta = {
  filename: "dunhuang-sample.jpg",
  width: 810,
  height: 1080,
  sizeLabel: "60.4 KB",
  processingMs: 1840,
};
