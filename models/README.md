# Trained model checkpoint

Place the trained E4 v4 checkpoint here:

`E4_v4_cpfedst_stage2.pt`

Expected source in the training project:

`CPFedST_Training_Project/checkpoints/E4_v4_cpfedst_stage2.pt`

The training run saved a checkpoint containing:

- `global_model`
- `local_models` (4 client states)
- experiment metadata

The checkpoint is intentionally excluded from this ZIP/Git repository because it is about 3 GB. Upload it separately to the Hostinger VPS.

Do not upload medical patient images to this repository. The application accepts one image at request time and sends it only to the model runtime.
