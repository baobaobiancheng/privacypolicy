import { assertContentIntegrity } from "./integrity";
import { mapV1Content } from "./index";

/** 服务端最终裁决内容哈希；浏览器只负责展示已解析的内容。 */
export const verifiedMapV1Content = assertContentIntegrity(mapV1Content);
