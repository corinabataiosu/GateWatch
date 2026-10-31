# GateWatch — modul video (ML)

Analiza imaginii camerei CAM-01, separată de analiza evenimentelor din SOC.

```
sursa_video.py          cadre: camera reală (OpenCV) sau scenă sintetică
caracteristici_video.py ML-02.1  luminozitate, claritate, diferență între cadre
model_video.py          ML-02.2  Isolation Forest + domeniul învățat; antrenare și artefact salvat
agent_video.py          cadre → caracteristici → scor → POST /api/video/telemetry (SOC), 1 eșantion/s
testare_camera.py       ML-01    test de captură de la camera laptopului
```

## Rulare

```bash
pip install -r ml/requirements.txt
python ml/src/agent_video.py                                  # scenă sintetică normală → SOC
python ml/src/agent_video.py --scenariu obturare --dupa 15    # obiectiv acoperit după 15 s
```

Scenarii sintetice: `normal`, `obturare` (imagine neagră), `orbire` (imagine saturată), `defocalizare`
(imagine neclară), `inghetare` (același cadru repetat).

Cu camera reală, modelul trebuie antrenat pe imaginea normală a acelei camere:

```bash
python ml/src/model_video.py --sursa camera --cadre 600 --iesire ml/models/video_camera.joblib
python ml/src/agent_video.py --sursa camera --model ml/models/video_camera.joblib
```

## Model

`models/video_iforest.joblib` (fișa: `models/video_iforest_card.json`) este antrenat pe 8 scene sintetice
diferite (număr de persoane, zgomot de senzor, iluminare variabilă). Intrare: `[luminozitate, log(1 + claritate),
diferență cadre]`. Un eșantion este anormal dacă scorul depășește pragul (percentila 99,5 a scorurilor normale)
**sau** dacă o caracteristică iese din domeniul învățat. Isolation Forest nu extrapolează: fără această
verificare, un cadru complet negru ar primi același scor ca cel mai întunecat cadru normal.

Pe scene sintetice nefolosite la antrenare: 0% alarme false în imagine normală și 100% detecție pentru
obturare, orbire, defocalizare și înghețare.

Modulul nu declară atacuri. SOC-ul transformă 3 eșantioane anormale consecutive într-o alertă `GW-V01`
(avertizare) și o închide după 5 eșantioane normale (vezi `docs/contracts.md` §6).

## Teste

```bash
python -m pytest ml/tests -q
```
