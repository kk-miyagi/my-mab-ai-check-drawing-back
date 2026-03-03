import cv2
import numpy as np
import sys


def mask_red_labels(img, hsv):
    # ラベル付与のRGBをHSVへ変換
    rgb = np.uint8([[[220, 20, 60]]])
    target_hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)[0][0]
    target_hsv = np.array(target_hsv)
    tol_h, tol_s, tol_v = 20, 30, 200

    lower = np.array([max(target_hsv[0] - tol_h, 0),
                      max(target_hsv[1] - tol_s, 0),
                      max(target_hsv[2] - tol_v, 0)])
    upper = np.array([180, 255, 255], dtype=np.uint8)
    mask = cv2.inRange(hsv, lower, upper)

    # 除去
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    expanded = cv2.dilate(mask, kernel, iterations=1)
    result = cv2.inpaint(img, expanded, inpaintRadius=1,
                         flags=cv2.INPAINT_TELEA)

    return result


def get_black_and_white_colors(img, hsv):

    # 黒色の範囲 (低明度)
    lower_black = np.array([0, 0, 0])
    upper_black = np.array([180, 255, 50])  # 明度(V)が低い部分を黒とみなす
    mask_black = cv2.inRange(hsv, lower_black, upper_black)

    # 白色の範囲 (低彩度 & 高明度)
    lower_white = np.array([0, 0, 200])
    upper_white = np.array([180, 50, 255])  # 彩度(S)が低く、明度(V)が高い部分を白とみなす
    mask_white = cv2.inRange(hsv, lower_white, upper_white)

    # 黒と白のマスクを結合
    mask_bw = cv2.bitwise_or(mask_black, mask_white)

    # 黒白以外のマスクを作成（反転）
    mask_color = cv2.bitwise_not(mask_bw)

    # マスクを適用して色部分を抽出
    result = cv2.bitwise_and(img, img, mask=mask_color)

    hs = result.T[0].flatten()
    ss = result.T[1].flatten()
    vs = result.T[2].flatten()
    tmp_values = np.array([20, 20, 20])
    return (np.array([hs.min(), ss.min(), vs.min()]) + tmp_values,
            np.array([hs.max(), ss.max(), vs.max()]) + tmp_values)


def main(img_name):
    image = cv2.imread(img_name)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    # ラベル付与部分を除去(後続処理ではこちらの画像情報を利用する)
    image = mask_red_labels(image, hsv)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    # 黒と白以外色の範囲を取得
    lower_color, upper_color = get_black_and_white_colors(image, hsv)
    print(f"lower:{lower_color}\n upper:{upper_color}")
    # 指定色のマスク作成
    mask = cv2.inRange(hsv, lower_color, upper_color)

    # ノイズ除去
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)

    # 輪郭抽出
    contours, _ = cv2.findContours(
        mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    print(len(contours))

    if len(contours) == 0:
        print("指定色の四角形が見つかりませんでした。")
    else:
        print(f"contours size: {len(contours)}")
        contours_list = [cv2.boundingRect(cnt) for cnt in contours]
        #     x, y, w, h = cv2.boundingRect(cnt)

    # 内包チェック関数
    def is_box_inside(inner_box, outer_box):
        """
        inner_box: (x, y, w, h) 内側の矩形
        outer_box: (x, y, w, h) 外側の矩形
        戻り値: True → 完全に内包, False → 内包されていない
        """
        ix, iy, iw, ih = inner_box
        ox, oy, ow, oh = outer_box

        # 内側の矩形の4辺
        inner_left = ix
        inner_top = iy
        inner_right = ix + iw
        inner_bottom = iy + ih

        # 外側の矩形の4辺
        outer_left = ox
        outer_top = oy
        outer_right = ox + ow
        outer_bottom = oy + oh

        # 完全に内包されている条件
        return (inner_left >= outer_left and
                inner_top >= outer_top and
                inner_right <= outer_right and
                inner_bottom <= outer_bottom)

    # 不要なBOXを削除する関数
    def get_correct_list(ls):
        # 完全に部分で分かれているものを統合する
        def get_concat_box_list(box_list):
            ret = box_list.copy()
            new_ls_dic = {}
            for i, l in enumerate(ret):
                not_l_ls = [x for x in ret if not x == l]
                new_l = list(l)
                for nl in not_l_ls:
                    # 縦方向に結合
                    print(f"{l} <-> {nl}")
                    if (l[0] == nl[0]) and (l[2] == nl[2]):
                        min_y = min(l[1], nl[1])
                        # 隣り合っていたら
                        # 線の太さを考慮する必要がある(10px)
                        if ((max(l[1], nl[1]) - 10 <= min_y + l[3] <= max(l[1], nl[1]) + 10)
                                or (max(l[1], nl[1]) - 10 <= min_y + nl[3] <= max(l[1], nl[1]) + 10)):
                            new_l[0] = l[0]
                            new_l[1] = min_y
                            new_l[2] = l[2]
                            new_l[3] = l[3] + nl[3]

                    # 横方向に結合
                    if (l[1] == nl[1]) and (l[3] == nl[3]):
                        min_x = min(l[0], nl[0])
                        print("find subbox!")
                        # 隣り合っていたら
                        # 線の太さを考慮する必要がある(10px)
                        if ((max(l[0], nl[0]) - 10 <= min_x + l[2] <= max(l[0], nl[0]) + 10)
                                or (max(l[0], nl[0]) - 10 <= min_x + nl[2] <= max(l[0], nl[0]) + 10)):
                            print("conect box!!")
                            new_l[0] = min_x
                            new_l[1] = l[1]
                            new_l[2] = l[2] + nl[2]
                            new_l[3] = l[3]

                if new_l != l:
                    new_ls_dic[i] = new_l
            # 結合部分を更新
            for i in new_ls_dic.keys():
                ret[i] = new_ls_dic[i]
            # 結合されていると必ず重複するので重複を削除
            # 重なってる部分を削除
            new_ret_set = {'_'.join([str(s) for s in x]) for x in ret}
            return [[int(s) for s in x.split('_')] for x in new_ret_set]

        # 完全に部分で分かれているものを統合する
        ret = get_concat_box_list(ls)

        # box内にできた小さなboxを削除
        inside_boxs = []
        for l in ret:
            not_l_ls = [x for x in ret if not x == l]
            if any([is_box_inside(l, x) for x in not_l_ls]):
                print(f"box inside others: {l}")
                inside_boxs.append(l)

        return [x for x in ret if not x in inside_boxs]

    correct_list = get_correct_list(contours_list)
    print(correct_list)
    return correct_list


if __name__ == '__main__':
    main(sys.argv[1])
