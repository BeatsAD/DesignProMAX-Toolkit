export function imageWriteErrorMessage(error:unknown):string {
  const value=typeof error==='string'?error:error instanceof Error?error.message:(error as {code?:string})?.code;
  switch(value){
    case 'LOCKED':return '原图或父容器已锁定，请解锁后重试，或新建裁剪图层';
    case 'STALE':case 'SELECT_IMAGE':case 'NODE_NOT_FOUND':return '原图或填充已变化，请重新生成裁剪预览';
    case 'IMAGE_TILE_REPLACE_UNSUPPORTED':return '平铺图片无法直接替换，请新建裁剪图层';
    case 'IMAGE_CROP_OUTSIDE_VIEW':return '裁剪内容位于原图可见区域之外，请新建裁剪图层';
    case 'IMAGE_TRANSFORM_INVALID':case 'IMAGE_FILL_UNSUPPORTED':return '图片填充或变换无效，请检查原图后重新生成预览';
    case 'INVALID':case 'IMAGE_LIMIT':return '裁剪结果无效或超过安全上限，请重新生成预览';
    case 'WRITE_STATE_UNKNOWN':return '写入结果待核对，请检查画布';
    case 'TIMEOUT':case 'REQUEST_TIMEOUT':return 'Figma 写入超时，请检查画布后重试';
    default:return 'Figma 写入失败，裁剪结果已保留，可重试或新建裁剪图层';
  }
}
