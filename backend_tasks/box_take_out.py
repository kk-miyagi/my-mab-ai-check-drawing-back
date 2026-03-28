import cv2
import numpy as np
import sys


def get_black_and_white_colors(img, hsv):

    # 黒色の範囲 (低明度)
    lower_black = np.array([0, 0, 0])
    upper_black = np.array([180, 255, 50])  # 明度(V)が低い部分を黒とみなす
    mask_black = cv2.inRange(hsv, lower_black, upper_black)

    # 白色の範囲 (低彩度 & 高明度)
    lower_white = np.array([0, 0, 200])
    upper_white = np.array([180, 40, 255])  # 彩度(S)が低く、明度(V)が高い部分を白とみなす
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
    # BGR → HSV に変換
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    # 黒と白以外色の範囲を取得
    lower_color, upper_color = get_black_and_white_colors(image, hsv)
    print(f"lower:{lower_color}\n upper:{upper_color}")
    # 指定色のマスク作成
    mask = cv2.inRange(hsv, lower_color, upper_color)

    # 輪郭抽出
    contours, _ = cv2.findContours(
            mask,
            cv2.RETR_LIST,
            cv2.CHAIN_APPROX_SIMPLE)

    if len(contours) == 0:
        print("指定色の四角形が見つかりませんでした。")
    else:
        print(f"contours size: {len(contours)}")
        contours_list = [
                cv2.boundingRect(cnt) for cnt in contours]
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
        # 一番大きな外枠を外す
        def get_extract_max_box_list(box_list):
            new_ls = box_list.copy()

            big_box = []
            for ls in new_ls:
                not_l_ls = [x for x in new_ls if not x == ls]
                if all([is_box_inside(x, ls) for x in not_l_ls]):
                    print(f"big box is : {ls}")
                    big_box = ls
                    break
            return [x for x in new_ls if not x == big_box]

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
                        const_1 = max(l[1], nl[1]) - 10 <= min_y + l[3]
                        const_2 = min_y + 1[3] <= max(l[1], nl[1]) + 10

                        const_3 = max(l[1], nl[1]) - 10 <= min_y + nl[3]
                        const_4 = min_y + nl[3] <= max(l[1], nl[1]) + 10

                        if ((const_1 and const_2) or (const_3 and const_4)):
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

        # 一番大きな外枠を外す
        ret = get_extract_max_box_list(ls)
        # 完全に部分で分かれているものを統合する
        ret = get_concat_box_list(ret)
        # box内にできた小さなboxを削除
        inside_boxs = []
        for ls in ret:
            not_l_ls = [x for x in ret if not x == ls]
            if any([is_box_inside(ls, x) for x in not_l_ls]):
                print(f"box inside others: {ls}")
                inside_boxs.append(ls)

        return [x for x in ret if not (x in inside_boxs)]

    correct_list = get_correct_list(contours_list)

    for i, cnt in enumerate(correct_list):
        roi = image[cnt[1]:cnt[1]+cnt[3], cnt[0]:cnt[0]+cnt[2]]

        # 切り出し画像保存
        cv2.imwrite(f"box_take_out/{img_name.split('.')[0]}_box_{i}.jpeg", roi)
        print(f"四角形を検出し保存しました: {i}")


if __name__ == '__main__':
    main(sys.argv[1])
