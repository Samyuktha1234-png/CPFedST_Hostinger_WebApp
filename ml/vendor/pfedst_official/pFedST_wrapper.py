import torch.nn as nn
from pFedST import *
import pdb
import torch

class pFedST(nn.Module):
    def __init__(self, backbone, args):
        super(pFedST, self).__init__()
        self.model, _ = clip.load(backbone)

