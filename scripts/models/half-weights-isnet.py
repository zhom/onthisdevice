# ISNet general use (DIS, Apache-2.0) from the rembg release with its weights stored as fp16 and
# cast to fp32 when the session loads: half the download, fp32 maths (ONNX Runtime folds the casts).
# Only the main mask output is kept.
#   curl -LO https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx
#   uv run --with onnx --with numpy python half-weights-isnet.py isnet-general-use.onnx isnet-general-use-f16w.onnx
import sys, onnx, numpy as np
from onnx import helper, numpy_helper, TensorProto
m = onnx.load(sys.argv[1])
m = onnx.utils.Extractor(m).extract_model([i.name for i in m.graph.input], ['output_image'])
g = m.graph
casts = []
for init in list(g.initializer):
    if init.data_type != TensorProto.FLOAT or np.prod(init.dims) < 1024:
        continue
    arr = numpy_helper.to_array(init).astype(np.float16)
    half = numpy_helper.from_array(arr, init.name + '_f16')
    g.initializer.remove(init)
    g.initializer.append(half)
    casts.append(helper.make_node('Cast', [half.name], [init.name], to=TensorProto.FLOAT, name=init.name + '_cast'))
nodes = casts + list(g.node)
del g.node[:]
g.node.extend(nodes)
onnx.checker.check_model(m)
onnx.save(m, sys.argv[2])
print('cast', len(casts))
