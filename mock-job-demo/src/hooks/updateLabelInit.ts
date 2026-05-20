import { NavigateFunction, To } from "react-router-dom";
import { createLabelApi } from "../api/createLabelApi";
import { UpdateLabelInitRequest } from "../types/createLabel";
import JSZip from "jszip";

type File = {
  name: string;
  url: string;
}

export const updateLabelInit = async (
  req: UpdateLabelInitRequest,
  navigate: NavigateFunction,
  to: To
): Promise<void> => {
  const res = await createLabelApi.updateLabelInit(req);

  const zip = await JSZip.loadAsync(res);
  const img = zip.file(/\.jpg$/)[0];
  const csv = zip.file(/\.csv$/)[0];
  const json = zip.file(/\.json$/)[0];

  // ラベル付与済みの図面
  let labelImg: File;
  if (img) {
    const imgBlob = await img.async('blob');
    const url = URL.createObjectURL(imgBlob);
    const path = img.name;
    const filename = path.split("/").pop()!;
    labelImg = {
      name: filename,
      url: url
    };
  } else {
    return
  }

  // ラベル付与の設計情報のCSV
  let labelData: File;
  if (csv) {
    const csvBlob = await csv.async('blob');
    const url = URL.createObjectURL(csvBlob);
    const path = csv.name;
    const filename = path.split("/").pop()!;
    labelData = {
      name: filename,
      url: url
    };
  } else {
    return
  }

  // ラベル付与済み図面の矩形の座標
  let rects;
  if (json) {
    const jsonText = await json.async('string');
    const parseJsonText = JSON.parse(jsonText);
    rects = Object.fromEntries(
      parseJsonText.filter(item => "id" in item && "rect" in item).map(item => [item.id, item.rect])
    )
  } else {
    return
  }

  const requestBody = {
    user: req.user,
    epic: req.epic,
    group_id: req.group_id,
    group_status: req.group_status,
    others: req.others,
    operations: req.operations,
  }

  navigate(to, { state: { labelImg, labelData, rects, requestBody } });
};
