# Exports Real-ESRGAN SRVGGNetCompact weights (BSD-3-Clause) to ONNX with dynamic height and width.
#   uv run --with torch --with onnx python export-realesr.py realesr-general-x4v3.pth out.onnx 32
import sys, torch, torch.nn as nn, torch.nn.functional as F

class SRVGGNetCompact(nn.Module):
    def __init__(self, num_in_ch=3, num_out_ch=3, num_feat=64, num_conv=16, upscale=4):
        super().__init__()
        self.upscale = upscale
        self.body = nn.ModuleList()
        self.body.append(nn.Conv2d(num_in_ch, num_feat, 3, 1, 1))
        self.body.append(nn.PReLU(num_parameters=num_feat))
        for _ in range(num_conv):
            self.body.append(nn.Conv2d(num_feat, num_feat, 3, 1, 1))
            self.body.append(nn.PReLU(num_parameters=num_feat))
        self.body.append(nn.Conv2d(num_feat, num_out_ch * upscale * upscale, 3, 1, 1))
        self.upsampler = nn.PixelShuffle(upscale)

    def forward(self, x):
        out = x
        for layer in self.body:
            out = layer(out)
        out = self.upsampler(out)
        base = F.interpolate(x, scale_factor=self.upscale, mode='nearest')
        return out + base

src, dst, num_conv = sys.argv[1], sys.argv[2], int(sys.argv[3])
net = SRVGGNetCompact(num_conv=num_conv)
state = torch.load(src, map_location='cpu')
state = state.get('params_ema', state.get('params', state))
net.load_state_dict(state, strict=True)
net.eval()
x = torch.rand(1, 3, 64, 64)
torch.onnx.export(net, x, dst, input_names=['input'], output_names=['output'], opset_version=17,
                  dynamic_axes={'input': {2: 'h', 3: 'w'}, 'output': {2: 'H', 3: 'W'}}, dynamo=False)
print('exported', dst)
