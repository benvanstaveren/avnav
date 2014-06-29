#!/usr/bin/env python
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2013 Andreas Vogel andreas@wellenvogel.net
#
#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
#
#  parts from this software (AIS decoding) are taken from the gpsd project
#  so refer to this BSD licencse also (see ais.py) or omit ais.py 
###############################################################################

import time
import subprocess
import threading
import os
import datetime
import glob

from avnav_util import *
from avnav_worker import *

#a writer for our track
class AVNTrackWriter(AVNWorker):
  def __init__(self,param):
    AVNWorker.__init__(self, param)
    self.track=[]
    #param checks
    throw=True
    self.getIntParam('cleanup', throw)
    self.getFloatParam('mindistance', throw)
    self.getFloatParam('interval', throw)
    self.tracklock=threading.Lock()
  @classmethod
  def getConfigName(cls):
    return "AVNTrackWriter"
  @classmethod
  def getConfigParam(cls, child=None):
    if child is not None:
      return None
    return {
            'interval':10, #write every 10 seconds
            'trackdir':"", #defaults to pdir/tracks
            'mindistance': 25, #only write if we at least moved this distance
            'cleanup': 25, #cleanup in hours
    }
  @classmethod
  def createInstance(cls, cfgparam):
    return AVNTrackWriter(cfgparam)
  
  def getName(self):
    return "TrackWriter"
  #write out the line
  #timestamp is a datetime object
  def writeLine(self,filehandle,timestamp,data):
    ts=timestamp.isoformat();
    if not ts[-1:]=="Z":
        ts+="Z"
    str="%s,%f,%f,%f,%f,%f\n"%(ts,data['lat'],data['lon'],(data.get('track') or 0),(data.get('speed') or 0),(data.get('distance') or 0))
    filehandle.write(str)
    filehandle.flush()
  def createFileName(self,dt):
    str=dt.strftime("%Y-%m-%d")+".avt"
    return str
  def cleanupTrack(self):
    numremoved=0
    cleanupTime=datetime.datetime.utcnow()-datetime.timedelta(hours=self.getIntParam('cleanup'))
    self.tracklock.acquire()
    while len(self.track) > 0:
      if self.track[0][0]<=cleanupTime:
        numremoved+=1
        self.track.pop(0)
      else:
        break
    self.tracklock.release()
    if numremoved > 0:
      AVNLog.debug("removed %d track entries older then %s",numremoved,cleanupTime.isoformat())
  
  #get the track as array of dicts
  #filter by maxnum and interval
  def getTrackFormatted(self,maxnum,interval):
    rt=[]
    curts=None
    intervaldt=datetime.timedelta(seconds=interval)
    self.tracklock.acquire()
    try:
      for tp in self.track:
        if curts is None or tp[0] > (curts + intervaldt):
          entry={
               'ts':AVNUtil.datetimeToTsUTC(tp[0]),
               'time':tp[0].isoformat(),
               'lat':tp[1],
               'lon':tp[2]}
          rt.append(entry)
          curts=tp[0]
    except:
      pass
    self.tracklock.release()
    return rt[-maxnum:]
  #read in a track file (our csv syntax)
  #return an array of track data
  def readTrackFile(self,filename):
    rt=[]
    if not os.path.exists(filename):
      AVNLog.debug("unable to read track file %s",filename)
      return rt
    f=open(filename,"r")
    if f is None:
      AVNLog.debug("unable to open track file %s",filename)
      return rt
    AVNLog.debug("reading track file %s",filename)
    try:
      for line in f:
        line=re.sub('#.*','',line)
        par=line.split(",")
        if len(par) < 3:
          continue
        try:
          newLat=float(par[1])
          newLon=float(par[2])
          track=float(par[3])
          speed=float(par[4])
          rt.append((AVNUtil.gt(par[0]),newLat,newLon,track,speed))
        except:
          AVNLog.warn("exception while reding track file %s: %s",filename,traceback.format_exc())
    except:
      pass
    f.close()
    AVNLog.debug("read %d entries from %s",len(rt),filename)
    return rt

  #write track data to gpx file
  #input: current track data
  def writeGpx(self,filename,data):
    header='''<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
           <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="avnav" 
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
            xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd"> 
            <trk>
            <name>avnav-track-%s</name>
            <trkseg>
            '''
    footer='''
            </trkseg>
            </trk>
            </gpx>
            '''
    trkpstr="""
             <trkpt lat="%2.9f" lon="%2.9f" ><time>%s</time><course>%3.1f</course><speed>%3.2f</speed></trkpt>
             """
    if os.path.exists(filename):
      os.unlink(filename)
    f=None
    try:
      f=open(filename,"w")
    except:
      pass
    if f is None:
      AVNlog.warn("unable to write to gpx file %s",filename)
      return
    AVNLog.debug("writing gpx file %s",filename)
    title,e=os.path.splitext(os.path.basename(filename))
    try:
      f.write(header%(title,))
      for trackpoint in data:
        ts=trackpoint[0].isoformat();
        if not ts[-1:]=="Z":
          ts+="Z"
        f.write(trkpstr%(trackpoint[1],trackpoint[2],ts,trackpoint[3],trackpoint[4]))
      f.write(footer);
    except:
      AVNLog.warn("Exception while writing gpx file %s: %s",filename,traceback.format_exc());
    f.close()

  #a converter running in a separate thread
  #will convert all found track files to gpx if the gpx file does not exist or is older
  def converter(self):
    infoName="TrackWriter:converter"
    AVNLog.info("%s thread %s started",infoName,AVNLog.getThreadId())
    while True:
      currentTracks=glob.glob(os.path.join(self.trackdir,"*.avt"))
      for track in currentTracks:
        try:
          gpx=re.sub(r"avt$","gpx",track)
          doCreate=True
          if os.path.exists(gpx):
            trackstat=os.stat(track)
            gpxstat=os.stat(gpx)
            if trackstat.st_mtime <= gpxstat.st_mtime:
              doCreate=False
          if doCreate:
            AVNLog.debug("creating gpx file %s",gpx)
            data=self.readTrackFile(track)
            self.writeGpx(gpx,data)
        except:
          pass
      time.sleep(60)
    
  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getConfigName()))
    f=None
    fname=None
    initial=True
    lastLat=None
    lastLon=None
    newFile=False
    loopCount=0
    while True:
      loopCount+=1
      currentTime=datetime.datetime.utcnow();
      
      trackdir=self.getStringParam("trackdir")
      if trackdir == "":
        trackdir=os.path.join(os.path.dirname(sys.argv[0]),'tracks')
      self.trackdir=trackdir
      if initial:
        theConverter=threading.Thread(target=self.converter)
        theConverter.daemon=True
        theConverter.start()
        AVNLog.info("started with dir=%s,interval=%d, distance=%d",
                trackdir,
                self.getFloatParam("interval"),
                self.getFloatParam("mindistance"))
        initial=False
      try:
        if not os.path.isdir(trackdir):
          os.makedirs(trackdir, 0775)
        curfname=os.path.join(trackdir,self.createFileName(currentTime))
        if not curfname == fname:
          fname=curfname
          if not f is None:
            f.close()
          newFile=True
          AVNLog.info("new trackfile %s",curfname)         
          if initial:
            if os.path.exists(curfname):
              self.setInfo('main', "reading old track data", AVNWorker.Status.STARTED)
              data=self.readTrackFile(curfname)
              for trkpoint in data:
                self.track.append((trkpoint[0],trkpoint[1],trkpoint[2]))
            initial=False
        if newFile:
          f=open(curfname,"a")
          f.write("#anvnav Trackfile started/continued at %s\n"%(currentTime.isoformat()))
          f.flush()
          newFile=False
          lastlat=None
          lastlon=None
          self.setInfo('main', "writing to %s"%(curfname,), AVNWorker.Status.NMEA)
        if loopCount >= 10:
          self.cleanupTrack()
          loopCount=0
        gpsdata=self.navdata.getMergedEntries('TPV',[])
        lat=gpsdata.data.get('lat')
        lon=gpsdata.data.get('lon')
        if not lat is None and not lon is None:
          if lastLat is None or lastLon is None:
            AVNLog.ld("write track entry",gpsdata.data)
            self.writeLine(f,currentTime,gpsdata.data)
            self.track.append((currentTime,lat,lon))
            lastLat=lat
            lastLon=lon
          else:
            dist=AVNUtil.distance((lastLat,lastLon), (lat,lon))*AVNUtil.NM
            if dist >= self.getFloatParam('mindistance'):
              gpsdata.data['distance']=dist
              AVNLog.ld("write track entry",gpsdata.data)
              self.writeLine(f,currentTime,gpsdata.data)
              self.track.append((currentTime,lat,lon))
              lastLat=lat
              lastLon=lon
      except Exception as e:
        AVNLog.error("exception in Trackwriter: %s",traceback.format_exc());
        pass
      initial=False
      #TODO: compute more exact sleeptime
      time.sleep(self.getFloatParam("interval"))
      
  def getTrack(self):
    return self.track
        