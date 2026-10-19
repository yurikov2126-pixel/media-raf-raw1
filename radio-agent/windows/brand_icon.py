"""Generate original brand mark and Windows ICO during PyInstaller build."""
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path

def create_icon(output):
    im=Image.new("RGBA",(256,256),(0,0,0,0))
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((5,5,250,250),radius=55,fill="#10162d")
    d.rounded_rectangle((19,19,237,237),radius=43,outline="#6865f3",width=5)
    for i,h in enumerate((54,92,142,106,67)):
        x=57+i*33
        d.rounded_rectangle((x,128-h//2,x+18,128+h//2),radius=9,fill="#a5b4fc" if i%2 else "#69e0d0")
    d.arc((68,45,188,167),190,350,fill="#f0eaff",width=9)
    d.ellipse((171,63,185,77),fill="#69e0d0")
    im.save(str(output),format="ICO",sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])

if __name__=="__main__":
    create_icon(Path(__file__).with_name("brand.ico"))
