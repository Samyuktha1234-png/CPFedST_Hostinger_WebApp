# Exact trained-model integration

The web app is written to load the same model family used by the training project.

## Required upstream code

The training scripts import:

```python
from pfedst_official import clip
```

Use the official pFedST implementation from:

https://github.com/JiayiChen815/pFedST

You have two options:

1. Copy the `pfedst_official` package from the existing working training project into `ml/vendor/pfedst_official/`.
2. Keep the package elsewhere and set `PFEDST_CODE_DIR` in `server/.env` to its parent directory.

The parent directory must contain the `pfedst_official` package.

## Required checkpoint

Set:

`MODEL_CHECKPOINT=/absolute/path/to/E4_v4_cpfedst_stage2.pt`

The runtime expects the checkpoint keys `global_model` and `local_models` and recreates four client models using the exact pFedST CLIP model loader used by training.

## Inference path

For a selected client:

1. Load frozen CLIP ViT-B/16 and restore the checkpoint.
2. Restore the selected personalized client state.
3. Convert the uploaded image to 224×224 and normalize it with the standard ImageNet normalization used by the training pipeline.
4. Call `encode_image(..., p_flag=True)` to obtain the personalized feature.
5. Normalize the feature.
6. Compare it with the eight normalized text embeddings generated from the training prompts.
7. Apply the model logit scale and softmax to obtain class probabilities.

The training-time GLOBAL/LOCAL/PROTECT router is not fabricated at inference time: the UI exposes the recorded routing statistics from E4 v4 as research metadata. New-image prediction itself is performed by the selected final personalized client model.
